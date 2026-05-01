import { Router, Response } from 'express';
import db from '../config/database';
import { requireAuth, AuthRequest } from '../middleware/auth';
import {
  getTrelloBoardInfo,
  registerTrelloWebhook,
  deleteTrelloWebhook,
} from '../services/trelloService';

const router = Router();

router.use(requireAuth);

router.get('/', (_req: AuthRequest, res: Response): void => {
  const boards = db
    .prepare('SELECT id, board_id, board_name, webhook_id, created_at FROM trello_boards')
    .all();
  res.json(boards);
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { board_id, trello_api_key, trello_token } = req.body;

  if (!board_id || !trello_api_key || !trello_token) {
    res.status(400).json({ error: 'board_id, trello_api_key, and trello_token are required' });
    return;
  }

  const boardInfo = await getTrelloBoardInfo(board_id, trello_api_key, trello_token);
  if (!boardInfo) {
    res.status(400).json({ error: 'Invalid board ID or Trello credentials' });
    return;
  }

  // Use the real Trello board ID (not the shortLink the user typed)
  const realBoardId = boardInfo.id;

  const existing = db.prepare('SELECT id FROM trello_boards WHERE board_id = ?').get(realBoardId);
  if (existing) {
    res.status(409).json({ error: 'Board already registered' });
    return;
  }

  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const callbackUrl = `${appBaseUrl}/api/webhook/trello`;

  let webhookId: string;
  try {
    webhookId = await registerTrelloWebhook(realBoardId, trello_api_key, trello_token, callbackUrl);
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Failed to register Trello webhook',
      hint: `Trello could not reach: ${callbackUrl} — make sure APP_BASE_URL is a public HTTPS URL`,
    });
    return;
  }

  const result = db
    .prepare(
      'INSERT INTO trello_boards (board_id, board_name, trello_api_key, trello_token, webhook_id) VALUES (?, ?, ?, ?, ?)'
    )
    .run(realBoardId, boardInfo.name, trello_api_key, trello_token, webhookId);

  res.status(201).json({
    message: 'Board registered successfully',
    id: result.lastInsertRowid,
    board_name: boardInfo.name,
    webhook_registered: true,
  });
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);

  const board = db.prepare('SELECT * FROM trello_boards WHERE id = ?').get(id) as
    | { id: number; board_id: string; trello_api_key: string; trello_token: string; webhook_id: string | null }
    | undefined;

  if (!board) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }

  if (board.webhook_id) {
    await deleteTrelloWebhook(board.webhook_id, board.trello_api_key, board.trello_token);
  }

  db.prepare('DELETE FROM trello_boards WHERE id = ?').run(id);
  res.json({ message: 'Board removed successfully' });
});

// Re-register webhook for an existing board
router.post('/:id/reregister-webhook', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);

  const board = db.prepare('SELECT * FROM trello_boards WHERE id = ?').get(id) as
    | { id: number; board_id: string; trello_api_key: string; trello_token: string; webhook_id: string | null }
    | undefined;

  if (!board) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }

  // Delete old webhook from Trello if it exists
  if (board.webhook_id) {
    await deleteTrelloWebhook(board.webhook_id, board.trello_api_key, board.trello_token);
  }

  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const callbackUrl = `${appBaseUrl}/api/webhook/trello`;

  let webhookId: string;
  try {
    webhookId = await registerTrelloWebhook(board.board_id, board.trello_api_key, board.trello_token, callbackUrl);
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Failed to register webhook',
      hint: `Trello could not reach: ${callbackUrl} — make sure APP_BASE_URL is a public HTTPS URL`,
    });
    return;
  }

  db.prepare('UPDATE trello_boards SET webhook_id = ? WHERE id = ?').run(webhookId, id);

  res.json({ message: 'Webhook re-registered successfully', webhookId, callbackUrl });
});

// Link bot to board
router.post('/:boardId/bots/:botId', (req: AuthRequest, res: Response): void => {
  const boardId = parseInt(req.params.boardId, 10);
  const botId = parseInt(req.params.botId, 10);

  const board = db.prepare('SELECT id FROM trello_boards WHERE id = ?').get(boardId);
  if (!board) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }

  const bot = db.prepare('SELECT id, verified FROM telegram_bots WHERE id = ?').get(botId) as
    | { id: number; verified: number }
    | undefined;

  if (!bot) {
    res.status(404).json({ error: 'Bot not found' });
    return;
  }

  if (bot.verified !== 1) {
    res.status(400).json({ error: 'Bot must be verified before linking to a board' });
    return;
  }

  try {
    db.prepare('INSERT INTO board_bot_mappings (board_id, bot_id) VALUES (?, ?)').run(boardId, botId);
    res.status(201).json({ message: 'Bot linked to board successfully' });
  } catch {
    res.status(409).json({ error: 'Bot is already linked to this board' });
  }
});

// Unlink bot from board
router.delete('/:boardId/bots/:botId', (req: AuthRequest, res: Response): void => {
  const boardId = parseInt(req.params.boardId, 10);
  const botId = parseInt(req.params.botId, 10);

  const result = db
    .prepare('DELETE FROM board_bot_mappings WHERE board_id = ? AND bot_id = ?')
    .run(boardId, botId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Mapping not found' });
    return;
  }

  res.json({ message: 'Bot unlinked from board successfully' });
});

// Get bots linked to a board
router.get('/:boardId/bots', (req: AuthRequest, res: Response): void => {
  const boardId = parseInt(req.params.boardId, 10);

  const bots = db
    .prepare(
      `SELECT tb.id, tb.name, tb.bot_username, tb.chat_id, tb.verified
       FROM telegram_bots tb
       JOIN board_bot_mappings bbm ON bbm.bot_id = tb.id
       WHERE bbm.board_id = ?`
    )
    .all(boardId);

  res.json(bots);
});

export default router;
