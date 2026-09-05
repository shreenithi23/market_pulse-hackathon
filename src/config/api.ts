/**
 * src/config/api.ts
 * Configures API client base URL and credentials for seamless local & distributed deployments.
 * When VITE_API_URL is set (e.g. on Vercel pointing to Render), all /api requests automatically
 * target the remote backend with credentials included.
 */

export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

// Seamless fetch interceptor for multi-host deployments
if (typeof window !== 'undefined' && API_BASE) {
  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    let resolvedInput: RequestInfo | URL = input;
    const resolvedInit: RequestInit = { ...(init || {}) };

    if (typeof input === 'string') {
      if (input.startsWith('/api')) {
        resolvedInput = `${API_BASE}${input}`;
        resolvedInit.credentials = resolvedInit.credentials || 'include';
      }
    } else if (input instanceof URL) {
      if (input.pathname.startsWith('/api')) {
        resolvedInput = new URL(`${API_BASE}${input.pathname}${input.search}`);
        resolvedInit.credentials = resolvedInit.credentials || 'include';
      }
    } else if (input instanceof Request) {
      const url = new URL(input.url, window.location.origin);
      if (url.pathname.startsWith('/api')) {
        const newUrl = `${API_BASE}${url.pathname}${url.search}`;
        resolvedInput = new Request(newUrl, input);
        resolvedInit.credentials = resolvedInit.credentials || 'include';
      }
    }

    return originalFetch(resolvedInput, resolvedInit);
  };
}
