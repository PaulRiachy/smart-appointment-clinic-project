import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { UserRole } from '@app/shared';

import { useAuth } from './context/AuthContext';

import Login from './pages/Login';
import Register from './pages/Register';
import BookAppointment from './pages/BookAppointment';
import MyAppointments from './pages/MyAppointments';
import LiveQueue from './pages/LiveQueue';
import Appointments from './pages/Appointments';

import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import StaffSchedule from './pages/StaffSchedule';

import AP_Navbar from './components/AP_Navbar';
import './styles/Management.css';

function LoadingScreen() {
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

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

// Get the specific landing page for a given user role
function getRoleHomePath(role: UserRole): string {
  switch (role) {
    case UserRole.CUSTOMER:
      return '/my-appointments';
    case UserRole.STAFF:
      return '/queue';
    case UserRole.ADMIN:
      return '/dashboard';
    default:
      return '/login';
  }
}

function RoleProtectedRoute({
  allowedRoles,
}: {
  allowedRoles: UserRole[];
}) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
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

function AdminLayout() {
  return (
    <>
      <AP_Navbar />
      <Outlet />
    </>
  );
}

function RoleHome() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getRoleHomePath(user.role)} replace />;
}

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <RoleHome />
          ) : (
            <Login />
          )
        }
      />

      <Route
        path="/register"
        element={
          isAuthenticated ? (
            <RoleHome />
          ) : (
            <Register />
          )
        }
      />

      <Route
        path="/"
        element={
          isAuthenticated ? (
            <RoleHome />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Customer routes */}
      <Route element={<ProtectedRoute />}>
        <Route
          element={
            <RoleProtectedRoute
              allowedRoles={[UserRole.CUSTOMER]}
            />
          }
        >
          <Route element={<CustomerLayout />}>
            <Route
              path="/book"
              element={<BookAppointment />}
            />

            <Route
              path="/my-appointments"
              element={<MyAppointments />}
            />
          </Route>
        </Route>
      </Route>

      {/* Staff and administrators */}
      <Route element={<ProtectedRoute />}>
        <Route
          element={
            <RoleProtectedRoute
              allowedRoles={[
                UserRole.STAFF,
                UserRole.ADMIN,
              ]}
            />
          }
        >
          <Route element={<StaffLayout />}>
            <Route
              path="/appointments"
              element={<Appointments />}
            />

            <Route
              path="/queue"
              element={<LiveQueue />}
            />
          </Route>
        </Route>
      </Route>

      {/* Administrator-only routes */}
      <Route element={<ProtectedRoute />}>
        <Route
          element={
            <RoleProtectedRoute
              allowedRoles={[UserRole.ADMIN]}
            />
          }
        >
          <Route element={<AdminLayout />}>
            <Route
              path="/dashboard"
              element={<Dashboard />}
            />

            <Route
              path="/services"
              element={<Services />}
            />

            <Route
              path="/staff"
              element={<StaffSchedule />}
            />
          </Route>
        </Route>
      </Route>

      {/* Catch-all route */}
      <Route
        path="*"
        element={
          !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : (
            <RoleHome />
          )
        }
      />
    </Routes>
  );
}
