import TelegramBot from 'node-telegram-bot-api';
import type { TrelloAction } from './trelloService';

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
  action: TrelloAction
): Promise<void> {
  const actionEmoji: Record<string, string> = {
    createCard: '🆕',
    updateCard: '🔄',
    deleteCard: '🗑️',
    commentCard: '💬',
    addMemberToCard: '➕👤',
    removeMemberFromCard: '➖👤',
    moveCardToBoard: '🚚',
    addAttachmentToCard: '📎',
    createList: '📋',
    updateList: '✏️',
    addMemberToBoard: '➕👥',
    removeMemberFromBoard: '➖👥',
    default: '📌',
  };

  const { description, cardUrl, cardNumber } = formatTrelloNotification(action, boardName);
  const emoji = getMoveListStatus(action)?.emoji || actionEmoji[action.type] || actionEmoji['default'];
  let message = `${emoji} ${description}`;
  if (cardUrl) {
    message += `\n\n🔗 <a href="${escapeHtml(cardUrl)}">เปิดใน Trello</a>`;
  }
  if (cardNumber) {
    message += `\n\n${cardNumber}`;
  }

  await sendMessage(token, chatId, message);
}

function formatTrelloNotification(
  action: TrelloAction,
  fallbackBoardName: string
): { description: string; cardUrl?: string; cardNumber?: string } {
  const who = getActionMemberMention(action);
  const card = getEntityText(action, 'card') || action.data?.card?.name || 'Untitled card';
  const cardDesc = action.data?.card?.desc;
  const cardLabels = getCardLabels(action);
  const board = action.data?.board?.name || fallbackBoardName;
  const list = getEntityText(action, 'list') || action.data?.list?.name;
  const listBefore = action.data?.listBefore?.name;
  const listAfter = action.data?.listAfter?.name;
  const text = action.data?.text;
  const member = getEntityText(action, 'member') || action.data?.member?.username || 'Unknown member';
  const cardUrl = getCardUrl(action);
  const moveListStatus = getMoveListStatus(action);
  const doneMove = moveListStatus?.key === 'done';
  const cardNumber = getCardNumberLine(action, cardUrl, doneMove);
  const cardLines = buildCardMessageLines({ board, card, cardDesc, cardLabels, who });

  switch (action.type) {
    case 'createCard':
      return {
        description: [
          ...cardLines,
          `🆕 รายการ: สร้างการ์ด${list ? ` ลง List <b>${escapeHtml(list)}</b>` : ''}`,
        ].join('\n'),
        cardUrl,
        cardNumber,
      };
    case 'updateCard':
      if (listBefore && listAfter) {
        return {
          description: [
            ...cardLines,
            `🚚 รายการ: ย้ายการ์ด`,
            `📍 จาก: <b>${escapeHtml(listBefore)}</b>`,
            formatMoveDestinationLine(listAfter, moveListStatus),
          ].join('\n'),
          cardUrl,
          cardNumber,
        };
      }
      return {
        description: [
          ...cardLines,
          `🔄 รายการ: อัปเดตการ์ด${list ? ` ใน List <b>${escapeHtml(list)}</b>` : ''}`,
        ].join('\n'),
        cardUrl,
        cardNumber,
      };
    case 'deleteCard':
      return {
        description: [
          ...cardLines,
          `🗑️ รายการ: ลบการ์ด${list ? ` จาก List <b>${escapeHtml(list)}</b>` : ''}`,
        ].join('\n'),
        cardUrl,
        cardNumber,
      };
    case 'commentCard':
      return {
        description: [
          ...cardLines,
          `💬 รายการ: คอมเมนต์ในการ์ด`,
          `💬 ข้อความ: <i>${escapeHtml(text || '')}</i>`,
        ].join('\n'),
        cardUrl,
        cardNumber,
      };
    case 'addMemberToCard':
      return {
        description: [
          ...cardLines,
          `➕ รายการ: เพิ่มสมาชิกในการ์ด`,
          `➕ สมาชิก: <b>${escapeHtml(member)}</b>`,
        ].join('\n'),
        cardUrl,
        cardNumber,
      };
    case 'removeMemberFromCard':
      return {
        description: [
          ...cardLines,
          `➖ รายการ: ลบสมาชิกออกจากการ์ด`,
          `➖ สมาชิก: <b>${escapeHtml(member)}</b>`,
        ].join('\n'),
        cardUrl,
        cardNumber,
      };
    case 'addAttachmentToCard':
      return {
        description: [
          ...cardLines,
          `📎 รายการ: เพิ่มไฟล์แนบในการ์ด`,
        ].join('\n'),
        cardUrl,
        cardNumber,
      };
    case 'createList':
      return {
        description: [
          `📋 Board: <b>${escapeHtml(board)}</b>`,
          `🆕 รายการ: สร้าง List`,
          `📍 List: <b>${escapeHtml(list || 'Untitled list')}</b>`,
          ``,
          who,
        ].join('\n'),
      };
    case 'updateList':
      return {
        description: [
          `📋 Board: <b>${escapeHtml(board)}</b>`,
          `✏️ รายการ: อัปเดต List`,
          `📍 List: <b>${escapeHtml(list || 'Untitled list')}</b>`,
          ``,
          who,
        ].join('\n'),
      };
    case 'addMemberToBoard':
      return {
        description: [
          `📋 Board: <b>${escapeHtml(board)}</b>`,
          `➕ รายการ: เพิ่มสมาชิกเข้า Board`,
          `➕ สมาชิก: <b>${escapeHtml(member)}</b>`,
          ``,
          who,
        ].join('\n'),
      };
    case 'removeMemberFromBoard':
      return {
        description: [
          `📋 Board: <b>${escapeHtml(board)}</b>`,
          `➖ รายการ: ลบสมาชิกออกจาก Board`,
          `➖ สมาชิก: <b>${escapeHtml(member)}</b>`,
          ``,
          who,
        ].join('\n'),
      };
    default:
      return {
        description: [
          ...cardLines,
          `📌 รายการ: ${escapeHtml(action.type)}`,
        ].filter(Boolean).join('\n'),
        cardUrl,
        cardNumber,
      };
  }
}

function getActionMemberMention(action: TrelloAction): string {
  const username =
    action.display?.entities?.memberCreator?.username ||
    action.memberCreator?.username ||
    getEntityText(action, 'memberCreator') ||
    action.memberCreator?.fullName ||
    'unknown';
  const mention = username.startsWith('@') ? username : `@${username}`;
  return escapeHtml(mention.replace(/\s+/g, ''));
}

function getEntityText(action: TrelloAction, entityKey: string): string | undefined {
  return action.display?.entities?.[entityKey]?.text;
}

function getCardNumberLine(
  action: TrelloAction,
  cardUrl?: string,
  doneMove = false
): string | undefined {
  const idShort = action.data?.card?.idShort;
  if (idShort === undefined) return undefined;
  const cardNumber = `#${idShort}`;
  const linkedCardNumber = cardUrl
    ? `<a href="${escapeHtml(cardUrl)}">${cardNumber}</a>`
    : cardNumber;
  if (doneMove) {
    return `<b>🎉 ปิดงานเรียบร้อย!</b> เลขการ์ด ${linkedCardNumber}`;
  }
  return `<b>🔢 เลขการ์ด:</b> ${linkedCardNumber}`;
}

function formatMoveDestinationLine(
  listAfter: string,
  moveListStatus?: { key: string; emoji: string; suffix: string }
): string {
  if (!moveListStatus) return `➡️ ไป: <b>${escapeHtml(listAfter)}</b>`;
  const suffix = moveListStatus.suffix ? ` ${moveListStatus.suffix}` : '';
  return `${moveListStatus.emoji} ไป: <b>${escapeHtml(listAfter)}</b>${suffix}`;
}

function getMoveListStatus(action: TrelloAction): { key: string; emoji: string; suffix: string } | undefined {
  const listAfter = action.data?.listAfter?.name;
  if (!action.data?.listBefore?.name || !listAfter) return undefined;

  switch (listAfter.trim().toLowerCase()) {
    case 'done':
      return { key: 'done', emoji: '🎊', suffix: '✅' };
    case 'doing':
      return { key: 'doing', emoji: '🔨', suffix: '' };
    default:
      return undefined;
  }
}

function buildCardMessageLines({
  board,
  card,
  cardDesc,
  cardLabels,
  who,
}: {
  board: string;
  card: string;
  cardDesc?: string;
  cardLabels: Array<{ name: string; color?: string }>;
  who: string;
}): string[] {
  return [
    `📋 Board: <b>${escapeHtml(board)}</b>`,
    `---------`,
    `📝 หัวข้อ: <b>${escapeHtml(card)}</b>`,
    `---------`,
    cardDesc ? `📄 รายละเอียด: ${escapeHtml(cardDesc)}` : undefined,
    cardLabels.length > 0 ? `🏷️ ป้าย: ${cardLabels.map(formatCardLabel).join(' ')}` : undefined,
    ``,
    who,
  ].filter((line): line is string => line !== undefined);
}

function getCardLabels(action: TrelloAction): Array<{ name: string; color?: string }> {
  const cardLabels = action.data?.card?.labels || [];
  const labelsFromCard = cardLabels
    .map<{ name: string; color?: string } | undefined>((label) => {
      const name = label.name || label.color;
      return name ? { name, color: label.color } : undefined;
    })
    .filter((label): label is { name: string; color?: string } => label !== undefined);

  if (labelsFromCard.length > 0) return labelsFromCard;

  return Object.values(action.display?.entities || {})
    .filter((entity) => entity.type === 'label' && entity.text)
    .map((entity) => ({ name: entity.text! }));
}

function formatCardLabel(label: { name: string; color?: string }): string {
  return `<b>${escapeHtml(label.name)}</b>`;
}

function getCardUrl(action: TrelloAction): string | undefined {
  const shortUrl = action.data?.card?.shortUrl;
  if (shortUrl) return shortUrl;

  const shortLink = action.data?.card?.shortLink || action.display?.entities?.card?.shortLink;
  return shortLink ? `https://trello.com/c/${encodeURIComponent(shortLink)}` : undefined;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
