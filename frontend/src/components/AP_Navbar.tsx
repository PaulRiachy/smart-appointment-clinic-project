import './styles/AP_Navbar.css';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserRole } from '@app/shared';
import { useAuth } from '../context/AuthContext';
import profileAvatar from '../assets/profile-avatar.svg';

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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIsProfileOpen(false);
  }, [location.pathname, user?._id]);

  useEffect(() => {
    if (!isProfileOpen) return;

    closeButtonRef.current?.focus();

    const dismissOutside = (event: PointerEvent | FocusEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsProfileOpen(false);
        profileButtonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('focusin', dismissOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('focusin', dismissOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileOpen]);

  if (!user) {
    return null;
  }

  const navigationItems = navigationByRole[user.role] || [];

  const handleLogout = () => {
    setIsProfileOpen(false);
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

        <div className="app-navbar__account" ref={accountRef}>
          <button
            ref={profileButtonRef}
            type="button"
            onClick={() => setIsProfileOpen((open) => !open)}
            className="app-navbar__profile-button"
            aria-label="Open your profile"
            aria-haspopup="dialog"
            aria-expanded={isProfileOpen}
            aria-controls={isProfileOpen ? 'navbar-profile' : undefined}
          >
            <img src={profileAvatar} alt="" width={44} height={44} />
          </button>

          {isProfileOpen && (
            <section
              id="navbar-profile"
              className="app-navbar__profile"
              role="dialog"
              aria-labelledby="navbar-profile-name"
            >
              <button
                ref={closeButtonRef}
                type="button"
                className="app-navbar__profile-close"
                aria-label="Close your profile"
                onClick={() => {
                  setIsProfileOpen(false);
                  profileButtonRef.current?.focus();
                }}
              >
                <svg viewBox="0 0 20 20" width={18} height={18} aria-hidden="true">
                  <path d="m5 5 10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
                </svg>
              </button>

              <div className="app-navbar__profile-summary">
                <img src={profileAvatar} alt="" width={56} height={56} />
                <h2 id="navbar-profile-name">{user.fullName}</h2>
                <span className="app-navbar__role">{getRoleLabel(user.role)}</span>
              </div>

              <dl className="app-navbar__profile-details">
                <div>
                  <dt>Email</dt>
                  <dd>{user.email}</dd>
                </div>
                {user.phone && (
                  <div>
                    <dt>Phone</dt>
                    <dd>{user.phone}</dd>
                  </div>
                )}
              </dl>

              <div className="app-navbar__profile-footer">
                <button type="button" onClick={handleLogout} className="app-navbar__logout">
                  Logout
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </header>
  );
}
