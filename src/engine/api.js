// Cliente da API dos jogos. Em localhost usa o Worker local (npm run dev na pasta worker).
const PROD = 'https://chumbada-jogos.chumbada-oficial.workers.dev';
const isLocal = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
export const API_BASE = import.meta.env.VITE_API_BASE || (isLocal ? 'http://localhost:8790' : PROD);

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api(path, { method = 'GET', body, token, raw = false, retries = 0 } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = 'Bearer ' + token;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(API_BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      if (raw && res.ok) return res;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(data.error || 'Não foi possível falar com o servidor.', res.status, data);
      return data;
    } catch (err) {
      lastErr = err instanceof ApiError ? err : new ApiError('Sem conexão com o servidor. Verifique sua internet.', 0);
      if (err instanceof ApiError && err.status && err.status < 500) break;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr;
}
