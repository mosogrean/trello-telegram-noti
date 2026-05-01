import TelegramBot from 'node-telegram-bot-api';

const botInstances = new Map<string, TelegramBot>();
const pollingTokens = new Set<string>();

export function getBot(token: string): TelegramBot {
  if (!botInstances.has(token)) {
    const bot = new TelegramBot(token, { polling: false });
    botInstances.set(token, bot);
  }
  return botInstances.get(token)!;
}

export async function removeBot(token: string): Promise<void> {
  const bot = botInstances.get(token);
  if (bot && pollingTokens.has(token)) {
    await bot.stopPolling().catch(() => {});
    pollingTokens.delete(token);
  }
  botInstances.delete(token);
}

export function startPollingForStartNoti(
  token: string,
  onStartNoti: (chatId: string) => Promise<void>
): void {
  const existing = botInstances.get(token);
  if (existing) {
    if (pollingTokens.has(token)) {
      existing.stopPolling().catch(() => {});
      pollingTokens.delete(token);
    }
    botInstances.delete(token);
  }

  const bot = new TelegramBot(token, { polling: true });
  botInstances.set(token, bot);
  pollingTokens.add(token);

  bot.on('polling_error', (err) => {
    console.error(`Polling error for token ...${token.slice(-6)}:`, err.message);
  });

  bot.onText(/\/start-noti/, async (msg) => {
    const chatId = msg.chat.id.toString();
    try {
      await onStartNoti(chatId);
    } catch (err) {
      console.error('Error handling /start-noti:', err);
    }
    await bot.stopPolling().catch(() => {});
    pollingTokens.delete(token);
    botInstances.delete(token);
  });
}

export async function sendMessage(token: string, chatId: string, text: string): Promise<void> {
  const bot = getBot(token);
  await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

export async function getBotInfo(token: string): Promise<{ username: string; firstName: string }> {
  const bot = getBot(token);
  const me = await bot.getMe();
  return { username: me.username || '', firstName: me.first_name };
}

export async function sendOtp(token: string, chatId: string, otp: string): Promise<void> {
  const message =
    `🔐 <b>Verification Code</b>\n\n` +
    `Your OTP code is: <code>${otp}</code>\n\n` +
    `This code expires in <b>10 minutes</b>.\n` +
    `Enter this code in the management dashboard to verify this bot.`;
  await sendMessage(token, chatId, message);
}

export async function sendStartNotiResponse(
  token: string,
  chatId: string,
  otp: string
): Promise<void> {
  const message =
    `✅ <b>Chat connected!</b>\n\n` +
    `📍 <b>Your Chat ID:</b> <code>${chatId}</code>\n\n` +
    `🔐 <b>Verification Code:</b> <code>${otp}</code>\n\n` +
    `Enter this code in the management dashboard to complete setup.\n` +
    `This code expires in <b>10 minutes</b>.`;
  await sendMessage(token, chatId, message);
}

export async function sendTrelloNotification(
  token: string,
  chatId: string,
  boardName: string,
  actionType: string,
  description: string,
  cardUrl?: string
): Promise<void> {
  const actionEmoji: Record<string, string> = {
    createCard: '🆕',
    updateCard: '✏️',
    deleteCard: '🗑️',
    commentCard: '💬',
    addMemberToCard: '👤',
    removeMemberFromCard: '👤',
    moveCardToBoard: '📦',
    addAttachmentToCard: '📎',
    createList: '📋',
    updateList: '📋',
    addMemberToBoard: '👥',
    removeMemberFromBoard: '👥',
    default: '📌',
  };

  const emoji = actionEmoji[actionType] || actionEmoji['default'];
  let message = `${emoji} <b>${boardName}</b>\n\n${description}`;
  if (cardUrl) {
    message += `\n\n🔗 <a href="${cardUrl}">View on Trello</a>`;
  }

  await sendMessage(token, chatId, message);
}
