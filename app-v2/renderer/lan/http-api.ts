import type { QcApi } from '../../shared/qc-api';

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, { credentials: 'same-origin', headers: { 'content-type': 'application/json', ...(init?.headers || {}) }, ...init });
  return response.json();
}

/** Cùng hợp đồng QcApi với preload Electron; chỉ thay transport thành HTTP. */
export function createLanHttpApi(): QcApi {
  return new Proxy({} as QcApi, {
    get(_target, property: string) {
      if (property === 'onStoreChanged') return (callback: (payload: { tables: string[]; testIds: string[] }) => void) => { const events = new EventSource('/api/events'); events.addEventListener('store-changed', (event) => callback(JSON.parse(event.data))); return () => events.close(); };
      if (property === 'login') return async (input: unknown) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(input) });
      if (property === 'logout') return async () => request('/api/auth/logout', { method: 'POST', body: '{}' });
      if (property === 'currentUser') return async () => {
        const result = await request('/api/session') as { ok: boolean; data?: unknown };
        return result.ok ? result.data ?? null : null;
      };
      return async (...args: unknown[]) => request('/api/rpc', { method: 'POST', body: JSON.stringify({ method: property, args }) });
    },
  });
}
