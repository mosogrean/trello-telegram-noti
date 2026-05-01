import { useState, FormEvent, CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/bots');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.logo}>🔔</span>
          <h1 style={styles.title}>Trello Telegram Notifier</h1>
          <p style={styles.subtitle}>Sign in to manage your notifications</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.field}>
            <label style={styles.label}>Username</label>
            <input
              style={styles.input}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
              autoFocus
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
  },
  card: {
    background: '#1a1a2e',
    borderRadius: 16,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    border: '1px solid #0f3460',
  },
  header: { textAlign: 'center', marginBottom: 32 },
  logo: { fontSize: 48 },
  title: { color: '#e94560', margin: '12px 0 4px', fontSize: 22, fontWeight: 700 },
  subtitle: { color: '#8892b0', fontSize: 14, margin: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { color: '#ccd6f6', fontSize: 13, fontWeight: 600 },
  input: {
    background: '#0f3460',
    border: '1px solid #1a4a7a',
    borderRadius: 8,
    color: '#ccd6f6',
    padding: '10px 14px',
    fontSize: 15,
    outline: 'none',
  },
  btn: {
    background: 'linear-gradient(135deg, #e94560, #c73652)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '12px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 6,
  },
  error: {
    background: 'rgba(233, 69, 96, 0.15)',
    border: '1px solid #e94560',
    borderRadius: 8,
    color: '#e94560',
    padding: '10px 14px',
    fontSize: 13,
  },
};
