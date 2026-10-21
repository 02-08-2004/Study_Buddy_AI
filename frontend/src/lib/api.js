import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  withCredentials: true,
  timeout: 120000 // 120 second timeout — allows rich AI & RAG processing without premature timeout
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sb_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global response error handling
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Network error (backend down, no internet)
    if (!err.response) {
      console.error('Network error:', err.message);
      return Promise.reject(new Error('Cannot connect to server. Check your connection.'));
    }

    // 401: only redirect to login for auth/me — not for every API call.
    // Other endpoints (courses, chat) handle their own 401 errors inline.
    if (err.response.status === 401) {
      const isAuthRoute = err.config?.url?.includes('/auth/me');
      if (isAuthRoute) {
        localStorage.removeItem('sb_token');
        window.location.href = '/login';
        return Promise.reject(err);
      }
      // For non-auth routes, surface the error message so the component can show it
      const serverMsg = err.response.data?.error || 'Session expired. Please re-authenticate.';
      return Promise.reject(new Error(serverMsg));
    }

    // 429: rate limit hit
    if (err.response.status === 429) {
      return Promise.reject(new Error('Too many requests. Please wait a moment and try again.'));
    }

    // 500+: server errors
    if (err.response.status >= 500) {
      const serverMsg = err.response.data?.error || 'Server error. Please try again.';
      return Promise.reject(new Error(serverMsg));
    }

    return Promise.reject(err);
  }
);

export default api;
