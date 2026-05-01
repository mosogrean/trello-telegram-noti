import { Router, Response } from 'express';
import db from '../config/database';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getBotInfo, removeBot, startPollingForStartNoti } from '../services/telegramService';
import { createAndSendOtp, createAndSendStartNotiOtp, verifyOtp } from '../services/otpService';

const router = Router();

router.use(requireAuth);

router.get('/', (_req: AuthRequest, res: Response): void => {
  const bots = db.prepare('SELECT id, name, bot_username, chat_id, verified, created_at FROM telegram_bots').all();
  res.json(bots);
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, bot_token } = req.body;

  if (!name || !bot_token) {
    res.status(400).json({ error: 'name and bot_token are required' });
    return;
  }

  let botInfo: { username: string; firstName: string };
  try {
    botInfo = await getBotInfo(bot_token);
  } catch {
    res.status(400).json({ error: 'Invalid bot token or cannot reach Telegram API' });
    return;
  }

  const existing = db.prepare('SELECT id FROM telegram_bots WHERE bot_token = ?').get(bot_token);
  if (existing) {
    res.status(409).json({ error: 'Bot with this token already exists' });
    return;
  }

  const result = db
    .prepare('INSERT INTO telegram_bots (name, bot_token, bot_username, chat_id, verified) VALUES (?, ?, ?, NULL, 0)')
    .run(name, bot_token, botInfo.username);

  const botId = result.lastInsertRowid as number;

  startPollingForStartNoti(bot_token, async (chatId: string) => {
    db.prepare('UPDATE telegram_bots SET chat_id = ? WHERE id = ?').run(chatId, botId);
    await createAndSendStartNotiOtp(botId, bot_token, chatId);
  });

  res.status(201).json({
    message: `Bot added. Send /start-noti to @${botInfo.username} in your Telegram chat to receive the OTP.`,
    botId,
    bot_username: botInfo.username,
  });
});

router.post('/:id/verify', (req: AuthRequest, res: Response): void => {
  const botId = parseInt(req.params.id, 10);
  const { otp } = req.body;

  if (!otp) {
    res.status(400).json({ error: 'OTP code is required' });
    return;
  }

  const bot = db.prepare('SELECT * FROM telegram_bots WHERE id = ?').get(botId) as
    | { id: number; verified: number; chat_id: string | null }
    | undefined;

  if (!bot) {
    res.status(404).json({ error: 'Bot not found' });
    return;
  }

  if (bot.verified === 1) {
    res.json({ message: 'Bot already verified' });
    return;
  }

  if (!bot.chat_id) {
    res.status(400).json({ error: 'Send /start-noti to the bot first to receive your OTP' });
    return;
  }

  const success = verifyOtp(botId, otp);
  if (!success) {
    res.status(400).json({ error: 'Invalid or expired OTP code' });
    return;
  }

  res.json({ message: 'Bot verified successfully' });
});

router.post('/:id/resend-otp', async (req: AuthRequest, res: Response): Promise<void> => {
  const botId = parseInt(req.params.id, 10);

  const bot = db.prepare('SELECT * FROM telegram_bots WHERE id = ?').get(botId) as
    | { id: number; bot_token: string; chat_id: string | null; verified: number }
    | undefined;

  if (!bot) {
    res.status(404).json({ error: 'Bot not found' });
    return;
  }

  if (bot.verified === 1) {
    res.status(400).json({ error: 'Bot is already verified' });
    return;
  }

  if (!bot.chat_id) {
    res.status(400).json({ error: 'Send /start-noti to the bot first to receive your OTP' });
    return;
  }

  try {
    await createAndSendOtp(botId, bot.bot_token, bot.chat_id);
    res.json({ message: 'OTP resent successfully' });
  } catch {
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const botId = parseInt(req.params.id, 10);

  const bot = db.prepare('SELECT * FROM telegram_bots WHERE id = ?').get(botId) as
    | { id: number; bot_token: string }
    | undefined;

  if (!bot) {
    res.status(404).json({ error: 'Bot not found' });
    return;
  }

  db.prepare('DELETE FROM telegram_bots WHERE id = ?').run(botId);
  await removeBot(bot.bot_token);

  res.json({ message: 'Bot removed successfully' });
});

export function resumePendingPolling(): void {
  const pendingBots = db
    .prepare('SELECT id, bot_token FROM telegram_bots WHERE verified = 0 AND chat_id IS NULL')
    .all() as Array<{ id: number; bot_token: string }>;

  for (const bot of pendingBots) {
    startPollingForStartNoti(bot.bot_token, async (chatId: string) => {
      db.prepare('UPDATE telegram_bots SET chat_id = ? WHERE id = ?').run(chatId, bot.id);
      await createAndSendStartNotiOtp(bot.id, bot.bot_token, chatId);
    });
  }

  if (pendingBots.length > 0) {
    console.log(`Resumed polling for ${pendingBots.length} pending bot(s)`);
  }
}

export default router;
