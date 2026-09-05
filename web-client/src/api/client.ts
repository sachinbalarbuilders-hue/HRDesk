import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT Bearer token, Active Organization and Active Branch
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('hrdesk_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const activeOrg = localStorage.getItem('hrdesk_active_organization');
  // Only send X-Organization-Id if there's an active org context.
  // Platform users may not have one (platform dashboard mode).
  if (activeOrg && activeOrg !== '0' && activeOrg !== '') {
    config.headers['X-Organization-Id'] = activeOrg;
  }
  
  const activeBranch = localStorage.getItem('hrdesk_active_branch');
  config.headers['X-Branch-Id'] = (activeBranch && activeBranch !== 'all') ? activeBranch : 'all';

  // Attach platform secret key if present (for Platform Owner / ops_console)
  const platformKey = sessionStorage.getItem('hrdesk_platform_key') || localStorage.getItem('hrdesk_platform_key');
  if (platformKey) {
    config.headers['X-Platform-Key'] = platformKey;
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor to handle 401 Unauthorized and auto-trigger notification refresh on mutations
apiClient.interceptors.response.use(
  (response) => {
    // If a mutation endpoint succeeds (POST / PUT / DELETE) and is not notifications mark-read, trigger instant refresh
    const method = response.config?.method?.toLowerCase();
    const url = response.config?.url || '';
    if ((method === 'post' || method === 'put' || method === 'delete') && !url.includes('/notifications/')) {
      window.dispatchEvent(new CustomEvent('notification-refresh'));
    }
    return response;
  },
  (error) => {
    // Also trigger on 404/denied gate scans if relevant
    const url = error.config?.url || '';
    if (url.includes('public-verify')) {
      window.dispatchEvent(new CustomEvent('notification-refresh'));
    }

    if (error.response?.status === 401) {
      // Clear token if unauthorized
      localStorage.removeItem('hrdesk_token');
      localStorage.removeItem('hrdesk_user');

      const publicPaths = ['/auth/sign-in', '/auth/forgot-password', '/login', '/register', '/landing', '/verify', '/onboarding'];
      const isPublicPath = window.location.pathname === '/' || publicPaths.some(p => window.location.pathname.startsWith(p));

      if (!isPublicPath) {
        window.location.href = '/auth/sign-in';
      }
    }
    return Promise.reject(error);
  }
);
