async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  // Se a resposta não for JSON, a API não está rodando nesse endereço
  // (ex.: hospedagem só do front devolvendo o index.html). Nunca tratar como sucesso.
  if (!(res.headers.get('content-type') || '').includes('application/json')) {
    const err = new Error('Servidor indisponível no momento. Tente de novo em instantes.');
    err.status = 503;
    throw err;
  }
  let data = {};
  try { data = await res.json(); } catch { /* sem corpo */ }
  if (!res.ok) {
    const err = new Error(data.error || 'Erro inesperado.');
    err.status = res.status;
    throw err;
  }
  return data;
}

import { demoApi } from './demoBackend.js';

// Build de demonstração (npm run build:demo): tudo roda no navegador, sem servidor.
export const IS_DEMO = import.meta.env.VITE_DEMO === '1';

const realApi = {
  me: () => request('GET', '/api/me'),
  login: (email, password) => request('POST', '/api/login', { email, password }),
  register: (data) => request('POST', '/api/register', data),
  logout: () => request('POST', '/api/logout'),
  updateDriver: (id, patch) => request('PATCH', `/api/drivers/${encodeURIComponent(id)}`, patch),
  removeDriver: (id) => request('DELETE', `/api/drivers/${encodeURIComponent(id)}`),
  loja: (codigo) => request('GET', `/api/loja?codigo=${encodeURIComponent(codigo)}`),
  sendLocation: (payload) => request('POST', '/api/location', payload),
};

export const api = IS_DEMO ? demoApi : realApi;

export const STATUS = {
  disponivel: { label: 'Disponível', color: '#0a9c50' },
  entrega: { label: 'Em entrega', color: '#ea1d2c' },
  pausa: { label: 'Pausa', color: '#f5a524' },
  offline: { label: 'Offline', color: '#6b6b72' },
};

export const effStatus = (d) => (d.online ? d.status : 'offline');
export const initials = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export function km(a, b) {
  const R = 6371, toR = (x) => (x * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function ago(ts, now = Date.now()) {
  if (!ts) return 'nunca';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  return `há ${Math.round(s / 3600)} h`;
}
