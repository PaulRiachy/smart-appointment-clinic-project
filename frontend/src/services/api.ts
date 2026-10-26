import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const AUTH_TOKEN_KEY = 'apex_auth_token';
export const AUTH_USER_KEY = 'apex_auth_user';

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

function getStoredToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function showGlobalMessage(message: string): void {
  window.dispatchEvent(
    new CustomEvent('apex:api-message', {
      detail: {
        type: 'error',
        message,
      },
    }),
  );
}

function clearAuthentication(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getStoredToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; error?: string }>) => {
    const status = error.response?.status;

    if (status === 401) {
      clearAuthentication();

      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }

    if (status === 403) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        'You do not have permission to perform this action.';

      showGlobalMessage(message);
    }

    return Promise.reject(error);
  },
);

export default api;