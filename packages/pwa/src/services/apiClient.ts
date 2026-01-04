export const UNAUTHORIZED_EVENT = 'auth:unauthorized';

export const emitUnauthorized = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
};

export async function apiFetch<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const response = await fetch(input, {
    credentials: 'include',
    ...init,
  });

  if (response.status === 401) {
    emitUnauthorized();
    return {
      success: false,
      code: 'unauthorized',
      error: 'Session expired. Please sign in again.',
      status: 401,
    } as T;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }

  const text = await response.text();
  return text as T;
}
