import { ADMIN_AGENT_BASE } from '../config/endpoints';

const ADMIN_AGENT_TOKEN = import.meta.env.VITE_ADMIN_AGENT_TOKEN || '';

export const buildAdminAgentUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${ADMIN_AGENT_BASE}${normalizedPath}`;
};

const withAuthHeaders = (init: RequestInit = {}): Headers => {
  const headers = new Headers(init.headers);

  if (ADMIN_AGENT_TOKEN) {
    headers.set('Authorization', `Bearer ${ADMIN_AGENT_TOKEN}`);
    headers.set('X-Admin-Token', ADMIN_AGENT_TOKEN);
  }

  const body = init.body;
  const trimmedBody = typeof body === 'string' ? body.trim() : '';
  const looksJson = trimmedBody.startsWith('{') || trimmedBody.startsWith('[');
  if (looksJson && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
};

export const adminAgentFetch = (path: string, init: RequestInit = {}): Promise<Response> => {
  const url = buildAdminAgentUrl(path);
  const headers = withAuthHeaders(init);
  // Use 'include' for same-origin requests (relative URLs)
  const defaultCredentials = ADMIN_AGENT_BASE.startsWith('http') ? 'omit' : 'include';

  return fetch(url, {
    ...init,
    headers,
    credentials: init.credentials ?? defaultCredentials,
  });
};

export const getAdminAgentToken = (): string => ADMIN_AGENT_TOKEN;
