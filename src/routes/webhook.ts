import { Router, Request, Response } from 'express';
import db from '../config/database';
import { describeAction, TrelloAction } from '../services/trelloService';
import { sendTrelloNotification } from '../services/telegramService';

const router = Router();

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
    | { id: number; board_name: string }
    | undefined;

  if (!board) return;

  const bots = db
    .prepare(
      `SELECT tb.bot_token, tb.chat_id
       FROM telegram_bots tb
       JOIN board_bot_mappings bbm ON bbm.bot_id = tb.id
       WHERE bbm.board_id = ? AND tb.verified = 1`
    )
    .all(board.id) as Array<{ bot_token: string; chat_id: string }>;

  if (bots.length === 0) return;

  const description = describeAction(action);
  const cardUrl = action.data?.card?.shortUrl;

  await Promise.allSettled(
    bots.map((bot) =>
      sendTrelloNotification(
        bot.bot_token,
        bot.chat_id,
        board.board_name,
        action.type,
        description,
        cardUrl
      )
    )
  );
});

export default router;
