import { useEffect, useState, CSSProperties } from 'react';
import { api } from '../api/client';
import Navbar from '../components/Navbar';

interface ServerConfig {
  appBaseUrl: string;
  webhookUrl: string;
  nodeEnv: string;
  port: string;
}

interface PingResult {
  ok: boolean;
  status?: number;
  latencyMs: number;
  url: string;
  error?: string;
}

type Method = 'GET' | 'POST' | 'DELETE' | 'HEAD';

interface Endpoint {
  method: Method;
  path: string;
  auth: boolean;
  description: string;
  note?: string;
}

const ENDPOINTS: { group: string; icon: string; items: Endpoint[] }[] = [
  {
    group: 'Auth',
    icon: '🔑',
    items: [
      { method: 'POST', path: '/api/auth/login', auth: false, description: 'Login — returns JWT bearer token' },
      { method: 'POST', path: '/api/auth/register', auth: false, description: 'Register new admin account' },
    ],
  },
  {
    group: 'Telegram Bots',
    icon: '🤖',
    items: [
      { method: 'GET', path: '/api/bots', auth: true, description: 'List all registered bots' },
      { method: 'POST', path: '/api/bots', auth: true, description: 'Add bot — starts polling for /start-noti, returns botId' },
      { method: 'POST', path: '/api/bots/:id/verify', auth: true, description: 'Verify OTP — marks bot as verified' },
      { method: 'POST', path: '/api/bots/:id/resend-otp', auth: true, description: 'Resend OTP to the linked Telegram chat' },
      { method: 'DELETE', path: '/api/bots/:id', auth: true, description: 'Remove bot and stop its polling' },
    ],
  },
  {
    group: 'Trello Boards',
    icon: '📋',
    items: [
      { method: 'GET', path: '/api/boards', auth: true, description: 'List all registered boards' },
      {
        method: 'POST', path: '/api/boards', auth: true,
        description: 'Register board — validates Trello credentials and creates webhook',
        note: 'Uses APP_BASE_URL to build the webhook callback URL',
      },
      { method: 'DELETE', path: '/api/boards/:id', auth: true, description: 'Remove board and delete its Trello webhook' },
      { method: 'GET', path: '/api/boards/:boardId/bots', auth: true, description: 'List bots linked to a board' },
      { method: 'POST', path: '/api/boards/:boardId/bots/:botId', auth: true, description: 'Link a verified bot to a board' },
      { method: 'DELETE', path: '/api/boards/:boardId/bots/:botId', auth: true, description: 'Unlink bot from board' },
    ],
  },
  {
    group: 'Webhook Receiver',
    icon: '📡',
    items: [
      { method: 'HEAD', path: '/api/webhook/trello', auth: false, description: 'Trello verifies webhook URL is alive (expects 200)', note: 'Trello calls this on webhook creation' },
      { method: 'GET', path: '/api/webhook/trello', auth: false, description: 'Trello alternate verification (expects 200)' },
      {
        method: 'POST', path: '/api/webhook/trello', auth: false,
        description: 'Receives Trello board events → sends Telegram notification to all linked bots',
        note: 'Trello posts here on every board action',
      },
    ],
  },
  {
    group: 'Developer Config',
    icon: '⚙️',
    items: [
      { method: 'GET', path: '/api/config', auth: true, description: 'Returns server config: APP_BASE_URL, webhook URL, env' },
      { method: 'GET', path: '/api/config/ping', auth: true, description: 'Pings the webhook URL and returns reachability + latency' },
    ],
  },
];

const METHOD_COLORS: Record<Method, CSSProperties> = {
  GET:    { background: 'rgba(0,122,255,0.15)', color: '#4da6ff', border: '1px solid #4da6ff' },
  POST:   { background: 'rgba(0,200,83,0.15)', color: '#00c853', border: '1px solid #00c853' },
  DELETE: { background: 'rgba(233,69,96,0.15)', color: '#e94560', border: '1px solid #e94560' },
  HEAD:   { background: 'rgba(136,146,176,0.15)', color: '#8892b0', border: '1px solid #8892b0' },
};

function copyToClipboard(text: string, setCopied: (v: boolean) => void) {
  navigator.clipboard.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  });
}

export default function ApiConfig() {
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [configError, setConfigError] = useState('');
  const [ping, setPing] = useState<PingResult | null>(null);
  const [pinging, setPinging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    api.get<ServerConfig>('/config')
      .then(setConfig)
      .catch((e) => setConfigError(e.message));
  }, []);

  const handlePing = async () => {
    setPinging(true);
    setPing(null);
    try {
      const result = await api.get<PingResult>('/config/ping');
      setPing(result);
    } catch (e) {
      setPing({ ok: false, error: e instanceof Error ? e.message : 'Failed', latencyMs: 0, url: '' });
    } finally {
      setPinging(false);
    }
  };

  const filterLower = filter.toLowerCase();
  const filtered = ENDPOINTS.map((group) => ({
    ...group,
    items: group.items.filter(
      (ep) =>
        !filterLower ||
        ep.path.toLowerCase().includes(filterLower) ||
        ep.description.toLowerCase().includes(filterLower) ||
        ep.method.toLowerCase().includes(filterLower)
    ),
  })).filter((g) => g.items.length > 0);

  const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

  return (
    <>
      <Navbar />
      <div style={styles.page}>
        <h2 style={styles.heading}>⚙️ API Config</h2>

        {/* Server Config Card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Server Configuration</h3>
          {configError && <div style={styles.error}>{configError}</div>}
          {!config && !configError && <p style={styles.muted}>Loading…</p>}
          {config && (
            <div style={styles.configGrid}>
              <ConfigRow label="Environment" value={config.nodeEnv} accent={config.nodeEnv === 'production' ? '#00c853' : '#ffc107'} />
              <ConfigRow label="Port" value={config.port} />
              <ConfigRow label="APP_BASE_URL" value={config.appBaseUrl} accent={config.appBaseUrl.includes('localhost') ? '#e94560' : '#00c853'} warn={config.appBaseUrl.includes('localhost') ? 'Trello cannot reach localhost — use a public URL' : undefined} />
              <ConfigRow label="Frontend API Base" value={apiBase} />
              <div style={styles.configRow}>
                <span style={styles.configLabel}>Webhook Callback URL</span>
                <div style={styles.webhookRow}>
                  <code style={styles.webhookUrl}>{config.webhookUrl}</code>
                  <button
                    style={styles.copyBtn}
                    onClick={() => copyToClipboard(config.webhookUrl, setCopied)}
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <span style={styles.hint}>This URL must be reachable from the internet for Trello webhooks to work</span>
              </div>
            </div>
          )}
        </div>

        {/* Ping Card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Webhook Reachability</h3>
          <p style={styles.muted}>Tests whether Trello can reach your webhook endpoint from this server</p>
          <div style={styles.pingRow}>
            <button style={styles.pingBtn} onClick={handlePing} disabled={pinging}>
              {pinging ? '⏳ Pinging…' : '🏓 Ping Webhook'}
            </button>
            {ping && (
              <div style={{ ...styles.pingResult, ...(ping.ok ? styles.pingOk : styles.pingFail) }}>
                <span style={styles.pingIcon}>{ping.ok ? '✓' : '✗'}</span>
                <span>
                  {ping.ok
                    ? `HTTP ${ping.status} — ${ping.latencyMs}ms`
                    : ping.error || `HTTP ${ping.status}`}
                </span>
                {ping.url && <code style={styles.pingUrl}>{ping.url}</code>}
              </div>
            )}
          </div>
        </div>

        {/* Endpoint Reference */}
        <div style={styles.card}>
          <div style={styles.endpointHeader}>
            <h3 style={styles.cardTitle}>Endpoint Reference</h3>
            <input
              style={styles.filterInput}
              placeholder="Filter by path, method, description…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>

          {filtered.map((group) => (
            <div key={group.group} style={styles.group}>
              <div style={styles.groupTitle}>
                <span style={styles.groupIcon}>{group.icon}</span>
                {group.group}
              </div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: 70 }}>Method</th>
                    <th style={styles.th}>Path</th>
                    <th style={{ ...styles.th, width: 50 }}>Auth</th>
                    <th style={styles.th}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((ep) => (
                    <tr key={ep.method + ep.path} style={styles.tr}>
                      <td style={styles.td}>
                        <span style={{ ...styles.badge, ...METHOD_COLORS[ep.method] }}>
                          {ep.method}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <code style={styles.pathCode}>{ep.path}</code>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        {ep.auth ? <span title="Requires JWT">🔒</span> : <span title="Public" style={styles.muted}>—</span>}
                      </td>
                      <td style={styles.td}>
                        <span>{ep.description}</span>
                        {ep.note && <div style={styles.noteText}>⚠ {ep.note}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {filtered.length === 0 && (
            <p style={styles.muted}>No endpoints match "{filter}"</p>
          )}
        </div>
      </div>
    </>
  );
}

function ConfigRow({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: string;
  accent?: string;
  warn?: string;
}) {
  return (
    <div style={styles.configRow}>
      <span style={styles.configLabel}>{label}</span>
      <code style={{ ...styles.configValue, ...(accent ? { color: accent } : {}) }}>{value}</code>
      {warn && <span style={styles.warnText}>⚠ {warn}</span>}
    </div>
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

  configGrid: { display: 'flex', flexDirection: 'column', gap: 14 },
  configRow: { display: 'flex', flexDirection: 'column', gap: 4 },
  configLabel: { color: '#8892b0', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  configValue: { color: '#ccd6f6', fontSize: 14, fontFamily: 'monospace', wordBreak: 'break-all' },
  warnText: { color: '#e94560', fontSize: 12, marginTop: 2 },

  webhookRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  webhookUrl: {
    color: '#4da6ff',
    fontSize: 14,
    fontFamily: 'monospace',
    background: '#0f3460',
    padding: '6px 10px',
    borderRadius: 6,
    wordBreak: 'break-all',
    flex: 1,
  },
  copyBtn: {
    background: '#0f3460',
    color: '#a8b2d8',
    border: '1px solid #1a4a7a',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 12,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  hint: { color: '#8892b0', fontSize: 12, marginTop: 2 },

  pingRow: { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 8 },
  pingBtn: {
    background: 'linear-gradient(135deg, #e94560, #c73652)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '9px 20px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  pingResult: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 14,
    flexWrap: 'wrap',
  },
  pingOk: { background: 'rgba(0,200,83,0.12)', border: '1px solid #00c853', color: '#00c853' },
  pingFail: { background: 'rgba(233,69,96,0.12)', border: '1px solid #e94560', color: '#e94560' },
  pingIcon: { fontSize: 16, fontWeight: 700 },
  pingUrl: { fontSize: 12, opacity: 0.7, fontFamily: 'monospace' },

  endpointHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 12,
  },
  filterInput: {
    background: '#0f3460',
    border: '1px solid #1a4a7a',
    borderRadius: 8,
    color: '#ccd6f6',
    padding: '8px 14px',
    fontSize: 13,
    outline: 'none',
    width: 280,
  },

  group: { marginBottom: 28 },
  groupTitle: {
    color: '#ccd6f6',
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  groupIcon: { fontSize: 16 },

  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    color: '#8892b0',
    fontSize: 11,
    fontWeight: 600,
    textAlign: 'left',
    padding: '7px 12px',
    borderBottom: '1px solid #0f3460',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tr: { borderBottom: '1px solid rgba(15,52,96,0.5)' },
  td: { color: '#ccd6f6', fontSize: 13, padding: '11px 12px', verticalAlign: 'top' },

  badge: {
    display: 'inline-block',
    borderRadius: 4,
    padding: '2px 7px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.3,
    fontFamily: 'monospace',
  },
  pathCode: {
    color: '#ccd6f6',
    fontFamily: 'monospace',
    fontSize: 13,
    background: 'rgba(15,52,96,0.5)',
    padding: '2px 6px',
    borderRadius: 4,
  },
  noteText: { color: '#ffc107', fontSize: 12, marginTop: 4 },
  muted: { color: '#8892b0', fontSize: 13, margin: 0 },
  error: {
    background: 'rgba(233,69,96,0.1)',
    border: '1px solid #e94560',
    borderRadius: 8,
    color: '#e94560',
    padding: '10px 14px',
    marginBottom: 14,
    fontSize: 13,
  },
};
