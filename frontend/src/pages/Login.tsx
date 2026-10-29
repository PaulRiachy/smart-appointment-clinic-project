
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { type IUser } from '@app/shared';
import AP_Button from '../components/AP_Button';
import AP_Textbox from '../components/AP_Textbox';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './styles/Auth.css';

interface AuthResponse {
  token?: string;
  accessToken?: string;
  user?: IUser;
  data?: {
    token?: string;
    accessToken?: string;
    user?: IUser;
  };
}

export default function Login() {
  const auth = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (auth.isLoading) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p>Checking your session...</p>
        </section>
      </main>
    );
  }

  if (auth.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    setError('');
    setIsSubmitting(true);

    try {
      const response = await api.post<AuthResponse>('/auth/login', {
        email: email.trim(),
        password,
      });

      const payload = response.data.data ?? response.data;
      const token = payload.token ?? payload.accessToken;
      const user = payload.user;

      if (!token || !user) {
        throw new Error(
          'Login succeeded, but the response did not contain the expected user and token.',
        );
      }

      auth.login(token, user);

      navigate('/', { replace: true });
    } catch (err: unknown) {
      console.error('Login handling failed:', err);

      const status =
        typeof err === 'object' && err !== null && 'response' in err
          ? (
              err as {
                response?: { status?: number };
              }
            ).response?.status
          : undefined;

      if (status === 401) {
        setError('Incorrect email or password. Check both and try again.');
      } else if (
        err instanceof Error &&
        err.message.startsWith('Login succeeded')
      ) {
        setError(err.message);
      } else if (status) {
        setError(`Login failed with server status ${status}.`);
      } else {
        setError(
          'We could not complete sign-in. Check the browser console for details.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-heading">
        <header className="auth-header">
          <Link className="auth-brand" to="/login">
            TeamFlow
          </Link>

          <h1 id="login-heading">Welcome back</h1>
          <p>Sign in to manage your appointments.</p>
        </header>

        {error && (
          <div className="auth-error" role="alert" aria-live="polite">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <AP_Textbox
              label="Email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="auth-field">
            <AP_Textbox
              label="Password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
            <br></br>
          <AP_Button
            type="submit"
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            Sign In
          </AP_Button>

          <p className="auth-footer">
            New here? <Link to="/register">Create an account</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
