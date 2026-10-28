
import './styles/Home.css';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AP_Button from '../components/AP_Button';

export default function Home() {
  const auth = useAuth();
  const navigate = useNavigate();

  if (auth.isLoading) {
    return (
      <main className="app-shell">
        <section className="welcome-card">
          <p className="muted">Checking your session...</p>
        </section>
      </main>
    );
  }

  if (!auth.isAuthenticated || !auth.user) {
    return <Navigate to="/login" replace />;
  }

  const { user } = auth;

  const handleLogout = () => {
    auth.logout();
    navigate('/login', { replace: true });
  };

  return (
    <main className="app-shell">
      <section className="welcome-card">
        <p className="eyebrow">APPOINTMENT PORTAL</p>

        <h1>You’re signed in</h1>

        <p className="muted">
          Authentication succeeded. Your role-based pages can be connected
          here when they are implemented.
        </p>

        <div className="user-summary">
          <span className="summary-label">Signed-in account</span>

          <strong>{user.fullName || user.email}</strong>

          {user.role && (
            <span className="role-pill">{String(user.role)}</span>
          )}
        </div>

        <AP_Button type="button" onClick={handleLogout}>
          Sign Out
        </AP_Button>
      </section>
    </main>
  );
}
