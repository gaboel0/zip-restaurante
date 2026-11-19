// Modo demonstração: imita o servidor dentro do navegador (sem rede).
// Usado no build "demo" (artefato compartilhável). Nada aqui vai para o servidor real.

const RESTAURANT = { id: 'r-demo', name: 'Restaurante Demo', email: 'loja@demo.test', code: 'DEMO42', lat: -23.5614, lng: -46.6826, role: 'loja' };
const OFFLINE_AFTER_MS = 30_000;
const TRAIL_MAX = 40;

let logged = false;
let restaurant = { ...RESTAURANT };
const drivers = new Map();
const listeners = new Set();
let started = false;

function emit() {
  const snap = snapshot();
  listeners.forEach((fn) => fn(snap));
}

function snapshot() {
  const now = Date.now();
  return {
    restaurant: { ...restaurant },
    serverTime: now,
    drivers: [...drivers.values()].map((d) => ({ ...d, trail: [...d.trail], online: d.updatedAt > 0 && now - d.updatedAt < OFFLINE_AFTER_MS })),
  };
}

function upsert(id, patch) {
  const prev = drivers.get(id) || {
    id, name: 'Motoboy', phone: '', status: 'disponivel', order: '', lat: null, lng: null,
    speed: 0, heading: 0, updatedAt: 0, simulated: true, trail: [], deliveriesToday: 0,
  };
  const d = { ...prev, ...patch };
  if (patch.lat != null && patch.lng != null) {
    d.updatedAt = Date.now();
    d.trail = [...prev.trail, [patch.lat, patch.lng]].slice(-TRAIL_MAX);
  }
  drivers.set(id, d);
  return d;
}

function randomPointNear(lat, lng, km) {
  const r = (km / 111) * Math.sqrt(Math.random());
  const t = Math.random() * 2 * Math.PI;
  return [lat + r * Math.cos(t), lng + (r * Math.sin(t)) / Math.cos((lat * Math.PI) / 180)];
}

function startSimulator() {
  if (started) return;
  started = true;
  const R = restaurant;
  const names = [['Carlos Silva', '(11) 98888-1001'], ['João Pereira', '(11) 98888-1002'], ['Rafael Souza', '(11) 98888-1003'], ['Marcos Lima', '(11) 98888-1004'], ['Bruno Costa', '(11) 98888-1005'], ['Diego Alves', '(11) 98888-1006']];
  const sims = names.map(([name, phone], i) => {
    const [lat, lng] = randomPointNear(R.lat, R.lng, 1.5);
    const id = `sim-${i + 1}`;
    upsert(id, { name, phone, lat, lng, status: i === 4 ? 'pausa' : i % 2 ? 'entrega' : 'disponivel', order: i % 2 ? `#${1040 + i}` : '', deliveriesToday: Math.floor(Math.random() * 8) });
    return { id, target: randomPointNear(R.lat, R.lng, 3.5), kmh: 25 + Math.random() * 20 };
  });
  // um motoboy que "perdeu o sinal" para mostrar o estado offline
  upsert('sim-off', { name: 'Paulo Nunes', phone: '(11) 98888-1007', lat: R.lat + 0.008, lng: R.lng - 0.012, status: 'disponivel', deliveriesToday: 3 });
  drivers.get('sim-off').updatedAt = Date.now() - 5 * 60_000;

  const TICK = 2000;
  setInterval(() => {
    for (const s of sims) {
      const d = drivers.get(s.id);
      if (!d) continue;
      if (d.status === 'pausa') { upsert(s.id, { lat: d.lat, lng: d.lng, speed: 0 }); continue; }
      const [tLat, tLng] = d.status === 'disponivel' ? [R.lat, R.lng] : s.target;
      const dLat = tLat - d.lat, dLng = tLng - d.lng;
      const distDeg = Math.hypot(dLat, dLng);
      const step = (((s.kmh / 3600) * (TICK / 1000)) / 111) * 6;
      if (distDeg < step) {
        if (d.status === 'entrega') upsert(s.id, { lat: tLat, lng: tLng, speed: 0, status: 'disponivel', order: '', deliveriesToday: d.deliveriesToday + 1 });
        else { s.target = randomPointNear(R.lat, R.lng, 3.5); upsert(s.id, { lat: tLat, lng: tLng, speed: 0, status: 'entrega', order: `#${1050 + Math.floor(Math.random() * 900)}` }); }
        continue;
      }
      const jitter = (Math.random() - 0.5) * step * 0.6;
      const heading = (Math.atan2(dLng, dLat) * 180) / Math.PI;
      upsert(s.id, { lat: d.lat + (dLat / distDeg) * step + jitter, lng: d.lng + (dLng / distDeg) * step - jitter, speed: s.kmh / 3.6, heading: (heading + 360) % 360 });
    }
    emit();
  }, TICK);
}

const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const fail = (msg, status) => { const e = new Error(msg); e.status = status; throw e; };

export const demoApi = {
  async me() { if (!logged) fail('Faça login.', 401); return { ...restaurant }; },
  async login(email, password) {
    await wait(500);
    if (!email || !password) fail('Preencha e-mail e senha.', 400);
    logged = true;
    return { ok: true };
  },
  async register({ name, email, password }) {
    await wait(600);
    if (!name || name.length < 2) fail('Digite o nome do restaurante.', 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email || '')) fail('E-mail inválido.', 400);
    if (!password || password.length < 8) fail('A senha precisa ter pelo menos 8 caracteres.', 400);
    restaurant = { ...RESTAURANT, name, email };
    logged = true;
    return { ok: true };
  },
  async logout() { await wait(150); logged = false; return { ok: true }; },
  async updateDriver(id, patch) {
    const cur = drivers.get(id);
    if (!cur) fail('motoboy não encontrado', 404);
    const p = {};
    if (['disponivel', 'entrega', 'pausa'].includes(patch.status)) p.status = patch.status;
    if (typeof patch.order === 'string') p.order = patch.order.slice(0, 60);
    if (p.status === 'disponivel' && cur.status === 'entrega') { p.deliveriesToday = cur.deliveriesToday + 1; p.order = ''; }
    const d = upsert(id, p);
    emit();
    return d;
  },
  async removeDriver(id) { drivers.delete(id); emit(); return { ok: true }; },
  async loja() { return { name: restaurant.name }; },
  async sendLocation() { return { ok: true }; },
};

// assinatura do "tempo real" (substitui o EventSource no modo demo)
export function subscribe(fn) {
  startSimulator();
  listeners.add(fn);
  fn(snapshot());
  const t = setInterval(() => fn(snapshot()), 5000); // atualiza online/offline
  return () => { listeners.delete(fn); clearInterval(t); };
}
