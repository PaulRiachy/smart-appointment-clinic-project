import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { UserRole } from '@app/shared';

import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import BookAppointment from './pages/BookAppointment';
import MyAppointments from './pages/MyAppointments';
import LiveQueue from './pages/LiveQueue';
import AP_Navbar from './components/AP_Navbar';

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function RoleProtectedRoute({
  allowedRoles,
}: {
  allowedRoles: UserRole[];
}) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Loading...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <Navigate
        to={
          user.role === UserRole.CUSTOMER
            ? '/my-appointments'
            : user.role === UserRole.ADMIN
              ? '/queue'
              : '/'
        }
        replace
      />
    );
  }

  return <Outlet />;
}

function CustomerLayout() {
  return (
    <>
      <AP_Navbar />
      <Outlet />
    </>
  );
}

function StaffLayout() {
  return (
    <>
      <AP_Navbar />
      <Outlet />
    </>
  );
}

export default function App() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <Login />
          )
        }
      />
      <Route
        path="/register"
        element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <Register />
          )
        }
      />

      <Route path="/" element={<Home />} />

      {/* Authenticated customer routes */}
      <Route element={<ProtectedRoute />}>
        <Route
          element={
            <RoleProtectedRoute allowedRoles={[UserRole.CUSTOMER]} />
          }
        >
          <Route element={<CustomerLayout />}>
            <Route path="/book" element={<BookAppointment />} />
            <Route
              path="/my-appointments"
              element={<MyAppointments />}
            />
          </Route>
        </Route>
      </Route>

      {/* Staff and administrators can operate the live queue */}
      <Route element={<ProtectedRoute />}>
        <Route
          element={
            <RoleProtectedRoute
              allowedRoles={[UserRole.STAFF, UserRole.ADMIN]}
            />
          }
        >
          <Route element={<StaffLayout />}>
            <Route path="/queue" element={<LiveQueue />} />
          </Route>
        </Route>
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to={
              !isAuthenticated
                ? '/login'
                : user?.role === UserRole.CUSTOMER
                  ? '/my-appointments'
                  : user?.role === UserRole.ADMIN
                    ? '/queue'
                    : '/'
            }
            replace
          />
        }
      />
    </Routes>
  );
}