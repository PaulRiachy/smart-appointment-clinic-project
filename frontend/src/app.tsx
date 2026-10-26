import { Route, Routes, useLocation } from 'react-router-dom';

import AP_Navbar from './components/AP_Navbar';
import { useAuth } from './context/AuthContext';

function PagePlaceholder() {
  const location = useLocation();

  const pageName =
    location.pathname === '/'
      ? 'Smart Appointment'
      : location.pathname
          .split('/')
          .filter(Boolean)
          .pop()
          ?.replace(/-/g, ' ') ?? 'Smart Appointment';

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold capitalize text-gray-900">
        {pageName}
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        The frontend infrastructure is ready. This page will be
        replaced with the corresponding feature screen.
      </p>
    </section>
  );
}

function LoginPlaceholder() {
  return (
    <section className="mx-auto mt-12 max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-gray-900">
        Sign in
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        The login form and authentication submission will be
        connected when the authentication screen is implemented.
      </p>
    </section>
  );
}

export default function App() {
  const { isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main
        className="flex min-h-screen items-center justify-center"
        aria-live="polite"
      >
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span
            className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
            aria-hidden="true"
          />
          Checking your session…
        </div>
      </main>
    );
  }

  const isLoginPage = location.pathname === '/login';

  return (
    <div className="min-h-screen">
      {!isLoginPage && <AP_Navbar />}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/login" element={<LoginPlaceholder />} />
          <Route path="*" element={<PagePlaceholder />} />
        </Routes>
      </main>
    </div>
  );
}