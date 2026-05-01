import { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { username, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={styles.nav}>
      <div style={styles.brand}>
        <span style={styles.logo}>🔔</span>
        <span style={styles.title}>Trello Telegram Notifier</span>
      </div>
      <div style={styles.links}>
        <Link to="/bots" style={styles.link}>Telegram Bots</Link>
        <Link to="/boards" style={styles.link}>Trello Boards</Link>
        <Link to="/config" style={styles.link}>API Config</Link>
        <span style={styles.user}>👤 {username}</span>
        <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
      </div>
    </nav>
  );
}

const styles: Record<string, CSSProperties> = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    borderBottom: '1px solid #0f3460',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  brand: { display: 'flex', alignItems: 'center', gap: 10 },
  logo: { fontSize: 24 },
  title: { color: '#e94560', fontWeight: 700, fontSize: 18, letterSpacing: 0.5 },
  links: { display: 'flex', alignItems: 'center', gap: 20 },
  link: {
    color: '#a8b2d8',
    textDecoration: 'none',
    fontWeight: 500,
    fontSize: 14,
    transition: 'color 0.2s',
  },
  user: { color: '#ccd6f6', fontSize: 14 },
  logoutBtn: {
    background: '#e94560',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
};
