import { Router, Request, Response } from 'express';
import db from '../config/database';
import { getTrelloCardDetails, TrelloAction } from '../services/trelloService';
import { sendTrelloNotification } from '../services/telegramService';

const router = Router();
const NOTIFICATION_DEBOUNCE_MS = 1500;
const RECENT_ACTION_TTL_MS = 60_000;

type BoardRow = {
  id: number;
  board_name: string;
  trello_api_key: string;
  trello_token: string;
};
type BotRow = { bot_token: string; chat_id: string };
type PendingNotification = {
  action: TrelloAction;
  board: BoardRow;
  bots: BotRow[];
  timer: NodeJS.Timeout;
};

const pendingNotifications = new Map<string, PendingNotification>();
const recentlySentActions = new Map<string, NodeJS.Timeout>();

// Trello sends HEAD to verify webhook URL
router.head('/trello', (req: Request, res: Response): void => {
  console.log(`[webhook] HEAD /api/webhook/trello — from ${req.ip}`);
  res.status(200).send();
});

// Trello sends GET to verify webhook URL
router.get('/trello', (req: Request, res: Response): void => {
  console.log(`[webhook] GET /api/webhook/trello — from ${req.ip}`);
  res.status(200).send('OK');
});

router.post('/trello', async (req: Request, res: Response): Promise<void> => {
  const actionType = (req.body as { action?: { type?: string } })?.action?.type ?? '(no action)';
  console.log(`[webhook] POST /api/webhook/trello — action: ${actionType}`);
  res.status(200).send('OK');

  const { action, model } = req.body as {
    action?: TrelloAction;
    model?: { id: string; name: string };
  };

  if (!action || !model) return;

  const board = db
    .prepare('SELECT * FROM trello_boards WHERE board_id = ?')
    .get(model.id) as
    | BoardRow
    | undefined;

  if (!board) return;

  const bots = db
    .prepare(
      `SELECT tb.bot_token, tb.chat_id
       FROM telegram_bots tb
       JOIN board_bot_mappings bbm ON bbm.bot_id = tb.id
       WHERE bbm.board_id = ? AND tb.verified = 1`
    )
    .all(board.id) as BotRow[];

  if (bots.length === 0) return;

  /*{
    "id": "69f4c67c9d68579bea4df2a4",
    "idMemberCreator": "5b8e2fb4de3c3b8e44fcb8c8",
    "data": {
        "card": {
            "id": "69f4c67c9d68579bea4df28e",
            "name": "test2",
            "idShort": 142,
            "shortLink": "6Osa7wTL"
        },
        "list": {
            "id": "65d71b3026271b9eb6f889c7",
            "name": "TODO"
        },
        "board": {
            "id": "65d71b2b2bd697f4e4823df2",
            "name": "INTERNAL",
            "shortLink": "99Zh3YTk"
        }
    },
    "appCreator": null,
    "type": "createCard",
    "date": "2026-05-01T15:27:56.261Z",
    "limits": null,
    "display": {
        "translationKey": "action_create_card",
        "entities": {
            "card": {
                "type": "card",
                "id": "69f4c67c9d68579bea4df28e",
                "shortLink": "6Osa7wTL",
                "text": "test2"
            },
            "list": {
                "type": "list",
                "id": "65d71b3026271b9eb6f889c7",
                "text": "TODO"
            },
            "memberCreator": {
                "type": "member",
                "id": "5b8e2fb4de3c3b8e44fcb8c8",
                "username": "barbossamm",
                "text": "Babossamm"
            }
        }
    },
    "memberCreator": {
        "id": "5b8e2fb4de3c3b8e44fcb8c8",
        "activityBlocked": false,
        "avatarHash": "b998462adfc6722bdbeb7d31e15a6b14",
        "avatarUrl": "https://trello-members.s3.amazonaws.com/5b8e2fb4de3c3b8e44fcb8c8/b998462adfc6722bdbeb7d31e15a6b14",
        "fullName": "Babossamm",
        "idMemberReferrer": null,
        "initials": "B",
        "nonPublic": {},
        "nonPublicAvailable": true,
        "username": "barbossamm"
    }
}*/

  queueTrelloNotification(action, board, bots);
});

function queueTrelloNotification(action: TrelloAction, board: BoardRow, bots: BotRow[]): void {
  const actionId = action.id;
  if (!actionId) {
    sendNotification(action, board, bots).catch((err) => {
      console.error('[webhook] Failed to send Trello notification:', err);
    });
    return;
  }

  if (recentlySentActions.has(actionId)) {
    console.log(`[webhook] Skipping duplicate Trello action: ${actionId}`);
    return;
  }

  const existing = pendingNotifications.get(actionId);
  if (existing) {
    clearTimeout(existing.timer);
  }

  const selectedAction = chooseNotificationAction(existing?.action, action);
  const timer = setTimeout(() => {
    pendingNotifications.delete(actionId);
    markActionAsSent(actionId);
    sendNotification(selectedAction, board, bots).catch((err) => {
      console.error('[webhook] Failed to send Trello notification:', err);
    });
  }, NOTIFICATION_DEBOUNCE_MS);

  pendingNotifications.set(actionId, {
    action: selectedAction,
    board,
    bots,
    timer,
  });
}

function chooseNotificationAction(
  currentAction: TrelloAction | undefined,
  nextAction: TrelloAction
): TrelloAction {
  if (!currentAction) return nextAction;
  if (isMoveCardAction(currentAction)) return currentAction;
  if (isMoveCardAction(nextAction)) return nextAction;
  return nextAction;
}

function isMoveCardAction(action: TrelloAction): boolean {
  return Boolean(action.data?.listBefore?.name && action.data?.listAfter?.name);
}

function markActionAsSent(actionId: string): void {
  const existingTimer = recentlySentActions.get(actionId);
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(() => {
    recentlySentActions.delete(actionId);
  }, RECENT_ACTION_TTL_MS);
  recentlySentActions.set(actionId, timer);
}

async function sendNotification(
  action: TrelloAction,
  board: BoardRow,
  bots: BotRow[]
): Promise<void> {
  const enrichedAction = await enrichActionCard(action, board.trello_api_key, board.trello_token);

  await Promise.allSettled(
    bots.map((bot) =>
      sendTrelloNotification(
        bot.bot_token,
        bot.chat_id,
        board.board_name,
        enrichedAction
      )
    )
  );
}

async function enrichActionCard(
  action: TrelloAction,
  apiKey: string,
  token: string
): Promise<TrelloAction> {
  const cardId = action.data?.card?.id;
  if (!cardId) return action;

  const cardDetails = await getTrelloCardDetails(cardId, apiKey, token);
  if (!cardDetails) return action;

  console.log(JSON.stringify(cardDetails));
  return {
    ...action,
    data: {
      ...action.data,
      card: {
        ...action.data.card,
        ...cardDetails,
      },
    },
  };
}

export default router;
