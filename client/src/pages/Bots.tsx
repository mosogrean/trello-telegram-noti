import { useEffect, useState, FormEvent, CSSProperties } from 'react';
import { api } from '../api/client';
import Navbar from '../components/Navbar';

interface Bot {
  id: number;
  name: string;
  bot_username: string;
  chat_id: string | null;
  verified: number;
  created_at: string;
}

export default function Bots() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add bot form
  const [name, setName] = useState('');
  const [botToken, setBotToken] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [pendingBotUsername, setPendingBotUsername] = useState('');

  // OTP verification
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  const fetchBots = async () => {
    try {
      const data = await api.get<Bot[]>('/bots');
      setBots(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load bots');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBots(); }, []);

  // Auto-refresh while any bot is waiting for /start-noti
  useEffect(() => {
    const hasAwaitingBots = bots.some((b) => !b.verified && !b.chat_id);
    if (!hasAwaitingBots) return;
    const interval = setInterval(fetchBots, 3000);
    return () => clearInterval(interval);
  }, [bots]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setAddLoading(true);
    try {
      const res = await api.post<{ message: string; botId: number; bot_username: string }>('/bots', {
        name,
        bot_token: botToken,
      });
      setSuccess(res.message);
      setPendingBotUsername(res.bot_username);
      setName('');
      setBotToken('');
      await fetchBots();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add bot');
    } finally {
      setAddLoading(false);
    }
  };

  const handleVerify = async (botId: number) => {
    setError('');
    setOtpLoading(true);
    try {
      const res = await api.post<{ message: string }>(`/bots/${botId}/verify`, { otp });
      setSuccess(res.message);
      setVerifyingId(null);
      setOtp('');
      await fetchBots();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async (botId: number) => {
    setError('');
    try {
      const res = await api.post<{ message: string }>(`/bots/${botId}/resend-otp`, {});
      setSuccess(res.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend OTP');
    }
  };

  const handleDelete = async (botId: number) => {
    if (!confirm('Are you sure you want to remove this bot?')) return;
    setError('');
    try {
      await api.delete(`/bots/${botId}`);
      setSuccess('Bot removed');
      setPendingBotUsername('');
      await fetchBots();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove bot');
    }
  };

  return (
    <>
      <Navbar />
      <div style={styles.page}>
        <h2 style={styles.heading}>Telegram Bots</h2>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        {/* Add Bot Form */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Add New Bot</h3>
          <form onSubmit={handleAdd} style={styles.form}>
            <input
              style={styles.input}
              placeholder="Bot display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              style={styles.input}
              placeholder="Bot token (from @BotFather)"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              required
            />
            <button style={styles.btn} type="submit" disabled={addLoading}>
              {addLoading ? 'Adding...' : 'Add Bot'}
            </button>
          </form>
        </div>

        {/* Awaiting /start-noti instruction */}
        {pendingBotUsername && (
          <div style={styles.instructionCard}>
            <h3 style={styles.cardTitle}>📱 Step 2 — Connect your chat</h3>
            <p style={styles.hint}>
              Open Telegram and send the following command to{' '}
              <strong style={{ color: '#ccd6f6' }}>@{pendingBotUsername}</strong>:
            </p>
            <div style={styles.commandBox}>
              <code style={styles.command}>/start-noti</code>
            </div>
            <p style={styles.hint}>
              The bot will reply with your <strong style={{ color: '#ccd6f6' }}>Chat ID</strong> and a{' '}
              <strong style={{ color: '#ccd6f6' }}>6-digit OTP</strong>. Enter the OTP below to verify.
            </p>
            <button style={styles.btnSecondary} onClick={() => setPendingBotUsername('')}>
              Dismiss
            </button>
          </div>
        )}

        {/* OTP Verification Panel */}
        {verifyingId && (
          <div style={styles.otpCard}>
            <h3 style={styles.cardTitle}>🔐 Enter OTP</h3>
            <p style={styles.hint}>
              Enter the 6-digit code the bot sent you after you ran <code>/start-noti</code>.
            </p>
            <div style={styles.otpRow}>
              <input
                style={{ ...styles.input, letterSpacing: 8, fontSize: 22, textAlign: 'center' }}
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <button style={styles.btn} onClick={() => handleVerify(verifyingId)} disabled={otpLoading}>
                {otpLoading ? 'Verifying...' : 'Verify'}
              </button>
              <button style={styles.btnSecondary} onClick={() => handleResendOtp(verifyingId)}>
                Resend OTP
              </button>
            </div>
          </div>
        )}

        {/* Bot List */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Registered Bots</h3>
          {loading ? (
            <p style={styles.hint}>Loading...</p>
          ) : bots.length === 0 ? (
            <p style={styles.hint}>No bots registered yet.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>@Username</th>
                  <th style={styles.th}>Chat ID</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bots.map((bot) => (
                  <tr key={bot.id} style={styles.tr}>
                    <td style={styles.td}>{bot.name}</td>
                    <td style={styles.td}>@{bot.bot_username}</td>
                    <td style={styles.td}>
                      {bot.chat_id ? (
                        <code>{bot.chat_id}</code>
                      ) : (
                        <span style={styles.awaiting}>awaiting /start-noti…</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <span style={bot.verified ? styles.badgeGreen : bot.chat_id ? styles.badgeYellow : styles.badgeGray}>
                        {bot.verified ? '✓ Verified' : bot.chat_id ? '⏳ Pending OTP' : '💬 Awaiting command'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {!bot.verified && bot.chat_id && (
                        <button
                          style={{ ...styles.btnSm, marginRight: 6 }}
                          onClick={() => { setVerifyingId(bot.id); setOtp(''); }}
                        >
                          Enter OTP
                        </button>
                      )}
                      <button style={styles.btnDanger} onClick={() => handleDelete(bot.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { maxWidth: 900, margin: '0 auto', padding: '24px 16px' },
  heading: { color: '#ccd6f6', fontSize: 24, fontWeight: 700, marginBottom: 20 },
  card: {
    background: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
  },
  instructionCard: {
    background: '#1a1a2e',
    border: '2px solid #16213e',
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
  },
  otpCard: {
    background: '#1a1a2e',
    border: '2px solid #e94560',
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
  },
  cardTitle: { color: '#e94560', fontSize: 16, fontWeight: 700, margin: '0 0 16px' },
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
  commandBox: {
    background: '#0f3460',
    border: '1px solid #1a4a7a',
    borderRadius: 8,
    padding: '12px 16px',
    margin: '12px 0',
    textAlign: 'center',
  },
  command: {
    color: '#e94560',
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: 2,
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
  },
  btnSecondary: {
    background: '#0f3460',
    color: '#a8b2d8',
    border: '1px solid #1a4a7a',
    borderRadius: 8,
    padding: '10px 16px',
    fontSize: 14,
    cursor: 'pointer',
  },
  btnSm: {
    background: '#0f3460',
    color: '#a8b2d8',
    border: '1px solid #1a4a7a',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    cursor: 'pointer',
  },
  btnDanger: {
    background: 'rgba(233,69,96,0.15)',
    color: '#e94560',
    border: '1px solid #e94560',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    cursor: 'pointer',
  },
  hint: { color: '#8892b0', fontSize: 14, margin: '0 0 8px' },
  awaiting: { color: '#8892b0', fontStyle: 'italic', fontSize: 13 },
  otpRow: { display: 'flex', gap: 10, alignItems: 'center' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    color: '#8892b0',
    fontSize: 12,
    fontWeight: 600,
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: '1px solid #0f3460',
    textTransform: 'uppercase',
  },
  tr: { borderBottom: '1px solid #0f3460' },
  td: { color: '#ccd6f6', fontSize: 14, padding: '12px 12px' },
  badgeGreen: {
    background: 'rgba(0,200,83,0.15)',
    color: '#00c853',
    border: '1px solid #00c853',
    borderRadius: 12,
    padding: '2px 10px',
    fontSize: 12,
    fontWeight: 600,
  },
  badgeYellow: {
    background: 'rgba(255,193,7,0.15)',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: 12,
    padding: '2px 10px',
    fontSize: 12,
    fontWeight: 600,
  },
  badgeGray: {
    background: 'rgba(136,146,176,0.15)',
    color: '#8892b0',
    border: '1px solid #8892b0',
    borderRadius: 12,
    padding: '2px 10px',
    fontSize: 12,
    fontWeight: 600,
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
