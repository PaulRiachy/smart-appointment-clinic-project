import {
  Link,
  useLocation,
} from 'react-router-dom';

import {
  UserRole,
} from '@app/shared';

import {
  useAuth,
} from '../context/AuthContext';

interface NavigationItem {
  label: string;
  path: string;
}

const navigationByRole: Record<
  UserRole,
  NavigationItem[]
> = {
  [UserRole.ADMIN]: [
    {
      label: 'Dashboard',
      path: '/dashboard',
    },
    {
      label: 'Services',
      path: '/services',
    },
    {
      label: 'Staff',
      path: '/staff',
    },
    {
      label: 'Queue',
      path: '/queue',
    },
    {
      label: 'Appointments',
      path: '/appointments',
    },
  ],

  [UserRole.STAFF]: [
    {
      label: 'Queue',
      path: '/queue',
    },
    {
      label: 'Appointments',
      path: '/appointments',
    },
  ],

  [UserRole.CUSTOMER]: [
    {
      label: 'Book Appointment',
      path: '/book',
    },
    {
      label: 'My Appointments',
      path: '/my-appointments',
    },
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
  const {
    user,
    logout,
  } = useAuth();

  const location = useLocation();

  if (!user) {
    return null;
  }

  const navigationItems =
    navigationByRole[user.role] || [];

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="mr-2 text-xl font-bold text-gray-900"
        >
          TeamFlow
        </Link>

        <nav
          className="flex flex-1 flex-wrap items-center gap-1"
          aria-label="Main navigation"
        >
          {navigationItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              location.pathname.startsWith(
                `${item.path}/`,
              );

            return (
              <Link
                key={item.path}
                to={item.path}
                className={[
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                ].join(' ')}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-gray-900">
              {user.fullName}
            </p>

            <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {getRoleLabel(user.role)}
            </span>
          </div>

          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}