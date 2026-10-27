import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { type IUser } from '@app/shared';
import api, {
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
} from '../services/api';

interface AuthContextValue {
  user: IUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: IUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

function getStoredUser(): IUser | null {
  const storedUser = localStorage.getItem(AUTH_USER_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as IUser;
  } catch {
    localStorage.removeItem(AUTH_USER_KEY);
    return null;
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<IUser | null>(getStoredUser);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem(AUTH_TOKEN_KEY),
  );
  const [isLoading, setIsLoading] = useState(true);

  const login = useCallback((newToken: string, newUser: IUser) => {
    localStorage.setItem(AUTH_TOKEN_KEY, newToken);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser));

    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);

    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);

      if (!storedToken) {
        if (isMounted) {
          setToken(null);
          setUser(null);
          setIsLoading(false);
        }

        return;
      }

      try {
        const response = await api.get('/auth/me');

        const authenticatedUser = response.data.data as IUser;

        if (!authenticatedUser || !authenticatedUser._id) {
          throw new Error('Invalid authentication response.');
        }

        if (isMounted) {
          setToken(storedToken);
          setUser(authenticatedUser);

          localStorage.setItem(
            AUTH_USER_KEY,
            JSON.stringify(authenticatedUser),
          );
        }
      } catch (error) {
        const status =
          error instanceof Error &&
          'response' in error &&
          typeof error.response === 'object' &&
          error.response !== null &&
          'status' in error.response
            ? Number(error.response.status)
            : undefined;

        if (isMounted && status === 401) {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem(AUTH_USER_KEY);

          setToken(null);
          setUser(null);
        }

        // Do NOT clear authentication for:
        // - network errors
        // - server errors
        // - timeouts
        // - temporary API failures
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void verifySession();

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isLoading,
      login,
      logout,
    }),
    [user, token, isLoading, login, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider.');
  }

  return context;
}

export default AuthContext;