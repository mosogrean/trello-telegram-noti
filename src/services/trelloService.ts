import https from 'https';
import http from 'http';

export interface TrelloAction {
  type: string;
  data: {
    card?: { name: string; shortUrl?: string; id?: string };
    list?: { name: string };
    listBefore?: { name: string };
    listAfter?: { name: string };
    board?: { name: string };
    text?: string;
    member?: { fullName: string };
  };
  memberCreator?: { fullName: string; username: string };
}

export function describeAction(action: TrelloAction): string {
  const who = action.memberCreator?.fullName || action.memberCreator?.username || 'Someone';
  const card = action.data?.card?.name;
  const list = action.data?.list?.name;
  const listBefore = action.data?.listBefore?.name;
  const listAfter = action.data?.listAfter?.name;
  const text = action.data?.text;
  const member = action.data?.member?.fullName;

  switch (action.type) {
    case 'createCard':
      return `${who} created card <b>"${card}"</b>${list ? ` in <i>${list}</i>` : ''}`;
    case 'updateCard':
      if (listBefore && listAfter) {
        return `${who} moved <b>"${card}"</b> from <i>${listBefore}</i> to <i>${listAfter}</i>`;
      }
      return `${who} updated card <b>"${card}"</b>`;
    case 'deleteCard':
      return `${who} deleted card <b>"${card}"</b>`;
    case 'commentCard':
      return `${who} commented on <b>"${card}"</b>:\n<i>${text}</i>`;
    case 'addMemberToCard':
      return `${who} added <b>${member}</b> to <b>"${card}"</b>`;
    case 'removeMemberFromCard':
      return `${who} removed <b>${member}</b> from <b>"${card}"</b>`;
    case 'addAttachmentToCard':
      return `${who} added an attachment to <b>"${card}"</b>`;
    case 'createList':
      return `${who} created list <b>"${list}"</b>`;
    case 'updateList':
      return `${who} updated list <b>"${list}"</b>`;
    case 'addMemberToBoard':
      return `${who} added <b>${member}</b> to the board`;
    case 'removeMemberFromBoard':
      return `${who} removed <b>${member}</b> from the board`;
    default:
      return `${who} performed action: ${action.type}`;
  }
}

export async function validateTrelloCredentials(
  apiKey: string,
  token: string
): Promise<{ valid: boolean; error?: string }> {
  return new Promise((resolve) => {
    const url = `https://api.trello.com/1/members/me?key=${apiKey}&token=${token}`;
    https
      .get(url, (res) => {
        resolve({ valid: res.statusCode === 200 });
      })
      .on('error', () => {
        resolve({ valid: false, error: 'Network error validating Trello credentials' });
      });
  });
}

export async function getTrelloBoardInfo(
  boardId: string,
  apiKey: string,
  token: string
): Promise<{ id: string; name: string } | null> {
  return new Promise((resolve) => {
    const url = `https://api.trello.com/1/boards/${boardId}?key=${apiKey}&token=${token}&fields=name,id`;
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data) as { id: string; name: string };
            resolve(parsed);
          } catch {
            resolve(null);
          }
        });
      })
      .on('error', () => resolve(null));
  });
}

export async function registerTrelloWebhook(
  boardId: string,
  apiKey: string,
  token: string,
  callbackUrl: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      callbackURL: callbackUrl,
      idModel: boardId,
      description: 'Trello Telegram Notification Webhook',
    });

    const options = {
      hostname: 'api.trello.com',
      path: `/1/webhooks/?key=${apiKey}&token=${token}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    console.log(`[trello] Registering webhook → callbackURL: ${callbackUrl}, board: ${boardId}`);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        console.log(`[trello] Webhook registration response — HTTP ${res.statusCode}: ${data}`);
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(data);
        } catch {
          // Plain text response (e.g. "invalid token")
          reject(new Error(`Trello: ${data.trim()}`));
          return;
        }
        if (parsed.id) {
          resolve(parsed.id as string);
        } else {
          const trelloMsg = (parsed.message as string) || data || `HTTP ${res.statusCode}`;
          reject(new Error(`Trello: ${trelloMsg}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[trello] Network error registering webhook: ${err.message}`);
      reject(new Error(`Network error: ${err.message}`));
    });
    req.write(postData);
    req.end();
  });
}

export async function deleteTrelloWebhook(
  webhookId: string,
  apiKey: string,
  token: string
): Promise<void> {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.trello.com',
      path: `/1/webhooks/${webhookId}?key=${apiKey}&token=${token}`,
      method: 'DELETE',
    };
    const req = https.request(options, () => resolve());
    req.on('error', () => resolve());
    req.end();
  });
}
