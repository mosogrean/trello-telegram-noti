import { useEffect, useState, FormEvent, CSSProperties } from 'react';
import { api } from '../api/client';
import Navbar from '../components/Navbar';

interface Board {
  id: number;
  board_id: string;
  board_name: string;
  webhook_id: string | null;
  created_at: string;
}

interface Bot {
  id: number;
  name: string;
  bot_username: string;
  chat_id: string;
  verified: number;
}

export default function Boards() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [allBots, setAllBots] = useState<Bot[]>([]);
  const [boardBots, setBoardBots] = useState<Record<number, Bot[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add board form
  const [boardId, setBoardId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [trelloToken, setTrelloToken] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const fetchAll = async () => {
    try {
      const [boardsData, botsData] = await Promise.all([
        api.get<Board[]>('/boards'),
        api.get<Bot[]>('/bots'),
      ]);
      setBoards(boardsData);
      setAllBots(botsData.filter((b) => b.verified === 1));

      const botMappings: Record<number, Bot[]> = {};
      await Promise.all(
        boardsData.map(async (board) => {
          const linked = await api.get<Bot[]>(`/boards/${board.id}/bots`);
          botMappings[board.id] = linked;
        })
      );
      setBoardBots(botMappings);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAddBoard = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setAddLoading(true);
    try {
      const res = await api.post<{ message: string; board_name: string }>('/boards', {
        board_id: boardId,
        trello_api_key: apiKey,
        trello_token: trelloToken,
      });
      setSuccess(`${res.message}: "${res.board_name}"`);
      setBoardId('');
      setApiKey('');
      setTrelloToken('');
      await fetchAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add board');
    } finally {
      setAddLoading(false);
    }
  };

  const handleReregisterWebhook = async (id: number) => {
    setError('');
    setSuccess('');
    try {
      const res = await api.post<{ message: string; callbackUrl: string }>(
        `/boards/${id}/reregister-webhook`,
        {}
      );
      setSuccess(`${res.message} → ${res.callbackUrl}`);
      await fetchAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to re-register webhook');
    }
  };

  const handleDeleteBoard = async (id: number) => {
    if (!confirm('Remove this board and its webhook?')) return;
    setError('');
    try {
      await api.delete(`/boards/${id}`);
      setSuccess('Board removed');
      await fetchAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove board');
    }
  };

  const handleLinkBot = async (boardId: number, botId: number) => {
    setError('');
    try {
      await api.post(`/boards/${boardId}/bots/${botId}`, {});
      setSuccess('Bot linked to board');
      await fetchAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to link bot');
    }
  };

  const handleUnlinkBot = async (boardId: number, botId: number) => {
    setError('');
    try {
      await api.delete(`/boards/${boardId}/bots/${botId}`);
      setSuccess('Bot unlinked');
      await fetchAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to unlink bot');
    }
  };

  const linkedBotIds = (boardId: number) =>
    new Set((boardBots[boardId] || []).map((b) => b.id));

  return (
    <>
      <Navbar />
      <div style={styles.page}>
        <h2 style={styles.heading}>Trello Boards</h2>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        {/* Add Board Form */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Register Trello Board</h3>
          <form onSubmit={handleAddBoard} style={styles.form}>
            <input
              style={styles.input}
              placeholder="Trello Board ID (from board URL)"
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              required
            />
            <input
              style={styles.input}
              placeholder="Trello API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
            />
            <input
              style={styles.input}
              placeholder="Trello Token"
              value={trelloToken}
              onChange={(e) => setTrelloToken(e.target.value)}
              required
            />
            <p style={styles.hint}>
              Get your API key from{' '}
              <a
                href="https://trello.com/app-key"
                target="_blank"
                rel="noreferrer"
                style={styles.link}
              >
                trello.com/app-key
              </a>
            </p>
            <button style={styles.btn} type="submit" disabled={addLoading}>
              {addLoading ? 'Registering...' : 'Register Board'}
            </button>
          </form>
        </div>

        {/* Board List */}
        {loading ? (
          <p style={styles.hint}>Loading...</p>
        ) : boards.length === 0 ? (
          <div style={styles.card}><p style={styles.hint}>No boards registered yet.</p></div>
        ) : (
          boards.map((board) => {
            const linked = linkedBotIds(board.id);
            return (
              <div key={board.id} style={styles.card}>
                <div style={styles.boardHeader}>
                  <div>
                    <h3 style={styles.boardName}>{board.board_name}</h3>
                    <code style={styles.code}>{board.board_id}</code>
                    <span style={board.webhook_id ? styles.badgeGreen : styles.badgeRed}>
                      {board.webhook_id ? '✓ Webhook Active' : '✗ No Webhook'}
                    </span>
                  </div>
                  <div style={styles.boardActions}>
                    {!board.webhook_id && (
                      <button
                        style={styles.btnReregister}
                        onClick={() => handleReregisterWebhook(board.id)}
                      >
                        🔄 Re-register Webhook
                      </button>
                    )}
                    <button style={styles.btnDanger} onClick={() => handleDeleteBoard(board.id)}>
                      Remove Board
                    </button>
                  </div>
                </div>
                {!board.webhook_id && (
                  <div style={styles.webhookWarn}>
                    <strong>Webhook not registered</strong> — Trello cannot reach the callback URL.
                    Fix <code>APP_BASE_URL</code> in <code>.env</code> to a public HTTPS URL, then click Re-register Webhook.
                  </div>
                )}

                <h4 style={styles.subTitle}>Linked Telegram Bots</h4>
                {allBots.length === 0 ? (
                  <p style={styles.hint}>No verified bots available. Add and verify a bot first.</p>
                ) : (
                  <div style={styles.botGrid}>
                    {allBots.map((bot) => {
                      const isLinked = linked.has(bot.id);
                      return (
                        <div key={bot.id} style={isLinked ? styles.botCardActive : styles.botCard}>
                          <div>
                            <div style={styles.botName}>{bot.name}</div>
                            <div style={styles.botUser}>@{bot.bot_username}</div>
                          </div>
                          <button
                            style={isLinked ? styles.btnUnlink : styles.btnLink}
                            onClick={() =>
                              isLinked
                                ? handleUnlinkBot(board.id, bot.id)
                                : handleLinkBot(board.id, bot.id)
                            }
                          >
                            {isLinked ? 'Unlink' : 'Link'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { maxWidth: 960, margin: '0 auto', padding: '24px 16px' },
  heading: { color: '#ccd6f6', fontSize: 24, fontWeight: 700, marginBottom: 20 },
  card: {
    background: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
  },
  cardTitle: { color: '#e94560', fontSize: 16, fontWeight: 700, margin: '0 0 16px' },
  subTitle: { color: '#8892b0', fontSize: 13, fontWeight: 600, margin: '16px 0 10px', textTransform: 'uppercase' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: {
    background: '#0f3460',
    border: '1px solid #1a4a7a',
    borderRadius: 8,
    color: '#ccd6f6',
    padding: '10px 14px',
    fontSize: 14,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  btn: {
    background: 'linear-gradient(135deg, #e94560, #c73652)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  boardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  boardActions: { display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 },
  btnReregister: {
    background: 'rgba(255,193,7,0.15)',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: 8,
    padding: '7px 14px',
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: 600,
  },
  webhookWarn: {
    background: 'rgba(233,69,96,0.08)',
    border: '1px solid rgba(233,69,96,0.4)',
    borderRadius: 8,
    color: '#e94560',
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: 14,
  },
  boardName: { color: '#ccd6f6', fontSize: 18, fontWeight: 700, margin: '0 0 6px' },
  code: { color: '#8892b0', fontSize: 12, background: '#0f3460', padding: '2px 8px', borderRadius: 4, marginRight: 10 },
  botGrid: { display: 'flex', flexWrap: 'wrap', gap: 12 },
  botCard: {
    background: '#0f3460',
    border: '1px solid #1a4a7a',
    borderRadius: 8,
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    minWidth: 200,
  },
  botCardActive: {
    background: 'rgba(0,200,83,0.08)',
    border: '1px solid #00c853',
    borderRadius: 8,
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    minWidth: 200,
  },
  botName: { color: '#ccd6f6', fontSize: 14, fontWeight: 600 },
  botUser: { color: '#8892b0', fontSize: 12 },
  btnLink: {
    background: '#e94560',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 600,
  },
  btnUnlink: {
    background: 'transparent',
    color: '#00c853',
    border: '1px solid #00c853',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 600,
  },
  btnDanger: {
    background: 'rgba(233,69,96,0.15)',
    color: '#e94560',
    border: '1px solid #e94560',
    borderRadius: 8,
    padding: '7px 14px',
    fontSize: 13,
    cursor: 'pointer',
  },
  hint: { color: '#8892b0', fontSize: 13, margin: '4px 0' },
  link: { color: '#e94560' },
  badgeGreen: {
    background: 'rgba(0,200,83,0.15)',
    color: '#00c853',
    border: '1px solid #00c853',
    borderRadius: 12,
    padding: '2px 10px',
    fontSize: 11,
    fontWeight: 600,
    marginLeft: 8,
  },
  badgeRed: {
    background: 'rgba(233,69,96,0.15)',
    color: '#e94560',
    border: '1px solid #e94560',
    borderRadius: 12,
    padding: '2px 10px',
    fontSize: 11,
    fontWeight: 600,
    marginLeft: 8,
  },
  error: {
    background: 'rgba(233,69,96,0.1)',
    border: '1px solid #e94560',
    borderRadius: 8,
    color: '#e94560',
    padding: '12px 16px',
    marginBottom: 16,
    fontSize: 14,
  },
  success: {
    background: 'rgba(0,200,83,0.1)',
    border: '1px solid #00c853',
    borderRadius: 8,
    color: '#00c853',
    padding: '12px 16px',
    marginBottom: 16,
    fontSize: 14,
  },
};
