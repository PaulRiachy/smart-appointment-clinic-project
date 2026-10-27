import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserRole } from '@app/shared';
import { useAuth } from '../context/AuthContext';

interface NavigationItem {
  label: string;
  path: string;
}

const navigationByRole: Record<UserRole, NavigationItem[]> = {
  [UserRole.ADMIN]: [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Services', path: '/services' },
    { label: 'Staff', path: '/staff' },
    { label: 'Queue', path: '/queue' },
    { label: 'Appointments', path: '/appointments' },
  ],
  [UserRole.STAFF]: [
    { label: 'Queue', path: '/queue' },
    { label: 'Appointments', path: '/appointments' },
  ],
  [UserRole.CUSTOMER]: [
    { label: 'Book Appointment', path: '/book' },
    { label: 'My Appointments', path: '/my-appointments' },
  ],
};

function getRoleLabel(role: UserRole): string {
  switch (role) {
    case UserRole.ADMIN:
      return 'Administrator';
    case UserRole.STAFF:
      return 'Staff';
    case UserRole.CUSTOMER:
      return 'Customer';
    default:
      return role;
  }
}

export default function AP_Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  const navigationItems = navigationByRole[user.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="app-navbar">
      <div className="app-navbar__inner">
        <Link to="/" className="app-navbar__brand">
          <span className="app-navbar__brand-icon" aria-hidden="true">
            T
          </span>
          <span>TeamFlow</span>
        </Link>

        <nav className="app-navbar__links" aria-label="Main navigation">
          {navigationItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              location.pathname.startsWith(`${item.path}/`);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`app-navbar__link${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="app-navbar__account">
          <div className="app-navbar__identity">
            <span className="app-navbar__name">{user.fullName}</span>
            <span className="app-navbar__role">
              {getRoleLabel(user.role)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="app-navbar__logout"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}