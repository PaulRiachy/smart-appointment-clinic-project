
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import type { IUser } from '@app/shared';
import AP_Button from '../components/AP_Button';
import AP_Textbox from '../components/AP_Textbox';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

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

function getAuthResult(responseData: AuthResponse) {
  const payload = responseData.data ?? responseData;

  return {
    token: payload.token ?? payload.accessToken,
    user: payload.user,
  };
}

export default function Register() {
  const auth = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

    if (fullName.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }

    if (password.length < 8) {
      setError('Your password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Your passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const registration = await api.post<AuthResponse>(
        '/auth/register',
        {
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
        },
      );

      let result = getAuthResult(registration.data);

      // Some registration endpoints create the account but do not
      // return a token. In that case, sign in with the new credentials.
      if (!result.token || !result.user) {
        const loginResponse = await api.post<AuthResponse>(
          '/auth/login',
          {
            email: email.trim(),
            password,
          },
        );

        result = getAuthResult(loginResponse.data);
      }

      if (!result.token || !result.user) {
        throw new Error(
          'Your account was created, but the server did not return the expected login details. Please sign in.',
        );
      }

      auth.login(result.token, result.user);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      console.error('Registration failed:', err);

      const errorObject = err as {
        response?: {
          status?: number;
          data?: {
            message?: string;
            error?: string;
          };
        };
        message?: string;
      };

      const status = errorObject.response?.status;
      const serverMessage =
        errorObject.response?.data?.message ??
        errorObject.response?.data?.error;

      if (status === 409) {
        setError(
          'An account with this email already exists. Sign in instead.',
        );
      } else if (
        status === 400 &&
        serverMessage
      ) {
        setError(serverMessage);
      } else if (errorObject.message?.includes('account was created')) {
        setError(errorObject.message);
      } else if (status) {
        setError(serverMessage || `Registration failed (${status}).`);
      } else {
        setError(
          'We could not complete registration. Check the browser console for details.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="register-heading">
        <header className="auth-header">
          <Link className="auth-brand" to="/register">
            TeamFlow
          </Link>
          <h1 id="register-heading">Create your account</h1>
          <p>Book and manage your appointments.</p>
        </header>

        {error && (
          <div className="auth-error" role="alert" aria-live="polite">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <AP_Textbox
              label="Full name"
              name="fullName"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Your full name"
              required
            />
          </div>

          <div className="auth-field">
            <AP_Textbox
              label="Phone"
              name="phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+961 71 234 567"
              required
            />
          </div>

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
              placeholder="At least 8 characters"
              required
            />
          </div>

          <div className="auth-field">
            <AP_Textbox
              label="Confirm password"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Enter your password again"
              required
            />
          </div>

            <br></br>

          <AP_Button
            type="submit"
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            Create account
          </AP_Button>

          <p className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>

        <p className="auth-footer">
          Staff and admin accounts are created by the clinic administrator.
        </p>
      </section>
    </main>
  );
}
