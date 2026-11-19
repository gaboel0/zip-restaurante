// ZipRotas · Painel da loja - servidor sem dependências (Node 18+)
// Login da loja:    http://localhost:3000/login.html
// Painel da loja:   http://localhost:3000/
// App do motoboy:   http://localhost:3000/motoboy.html?loja=CODIGO
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const SIMULATE = process.env.SIMULATE !== '0';
const OFFLINE_AFTER_MS = 30_000;
const SESSION_DAYS = 7;
const DATA_DIR = path.join(__dirname, 'data');
const RESTAURANTS_FILE = path.join(DATA_DIR, 'restaurants.json');
const PUBLIC = path.join(__dirname, 'public');

// ---------- Contas de restaurante ----------
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}
function checkPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}
function newCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(6), (b) => chars[b % chars.length]).join('');
}

let restaurants = [];
function loadRestaurants() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(RESTAURANTS_FILE)) {
    restaurants = JSON.parse(fs.readFileSync(RESTAURANTS_FILE, 'utf8'));
    return;
  }
  // Conta de demonstração (credenciais no README.md)
  restaurants = [{
    id: 'r-demo', name: 'Restaurante Demo', email: 'loja@demo.test',
    passwordHash: hashPassword('zip-demo-4821'), code: 'DEMO42',
    lat: -23.5614, lng: -46.6826, demo: true,
  }];
  saveRestaurants();
}
function saveRestaurants() { fs.writeFileSync(RESTAURANTS_FILE, JSON.stringify(restaurants, null, 2)); }
const publicRestaurant = (r) => ({ id: r.id, name: r.name, email: r.email, code: r.code, lat: r.lat, lng: r.lng });
const byCode = (code) => restaurants.find((r) => r.code === String(code || '').trim().toUpperCase());

// ---------- Sessões (cookie HttpOnly) ----------
const sessions = new Map(); // token -> { rid, expires }
function createSession(rid) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { rid, expires: Date.now() + SESSION_DAYS * 864e5 });
  return token;
}
function getSession(req) {
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)zr_sess=([a-f0-9]{64})/);
  if (!m) return null;
  const s = sessions.get(m[1]);
  if (!s || s.expires < Date.now()) { sessions.delete(m[1]); return null; }
  const r = restaurants.find((x) => x.id === s.rid);
  return r ? { token: m[1], restaurant: r } : null;
}
const cookie = (token, maxAge) => `zr_sess=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;

// limite simples de tentativas de login por IP
const attempts = new Map();
function tooManyAttempts(ip) {
  const a = attempts.get(ip) || { n: 0, until: 0 };
  if (a.until > Date.now()) return true;
  return false;
}
function failAttempt(ip) {
  const a = attempts.get(ip) || { n: 0, until: 0 };
  a.n++;
  if (a.n >= 5) { a.until = Date.now() + 60_000; a.n = 0; }
  attempts.set(ip, a);
}

// ---------- Motoboys (separados por restaurante) ----------
const drivers = new Map(); // `${rid}:${id}` -> driver
const clients = new Set(); // { res, rid }
const TRAIL_MAX = 40;
const key = (rid, id) => `${rid}:${id}`;

function upsertDriver(rid, id, patch) {
  const prev = drivers.get(key(rid, id)) || {
    id, rid, name: 'Motoboy', phone: '', status: 'disponivel', order: '',
    lat: null, lng: null, speed: 0, heading: 0, accuracy: null,
    updatedAt: 0, simulated: false, trail: [], deliveriesToday: 0,
  };
  const d = { ...prev, ...patch };
  if (patch.lat != null && patch.lng != null) {
    d.updatedAt = Date.now();
    d.trail = [...prev.trail, [patch.lat, patch.lng]].slice(-TRAIL_MAX);
  }
  drivers.set(key(rid, id), d);
  broadcast();
  return d;
}

function snapshot(rid) {
  const now = Date.now();
  const r = restaurants.find((x) => x.id === rid);
  return {
    restaurant: r ? publicRestaurant(r) : null,
    serverTime: now,
    drivers: [...drivers.values()].filter((d) => d.rid === rid).map(({ rid: _r, ...d }) => ({
      ...d, online: d.updatedAt > 0 && now - d.updatedAt < OFFLINE_AFTER_MS,
    })),
  };
}

let broadcastTimer = null;
function broadcast() {
  if (broadcastTimer) return; // agrupa atualizações (máx. 4/s)
  broadcastTimer = setTimeout(() => {
    broadcastTimer = null;
    const cache = new Map();
    for (const c of clients) {
      if (!cache.has(c.rid)) cache.set(c.rid, `data: ${JSON.stringify(snapshot(c.rid))}\n\n`);
      c.res.write(cache.get(c.rid));
    }
  }, 250);
}
setInterval(broadcast, 5000); // atualiza "online/offline" mesmo sem movimento

// ---------- HTTP ----------
function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); } });
  });
}
function send(res, code, obj, headers = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(obj));
}
function redirect(res, to) { res.writeHead(302, { Location: to }); res.end(); }

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };
const VALID_STATUS = new Set(['disponivel', 'entrega', 'pausa']);

function serveFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, { error: 'não encontrado' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  const session = getSession(req);
  try {
    // --- autenticação ---
    if (p === '/api/login' && req.method === 'POST') {
      const ip = req.socket.remoteAddress;
      if (tooManyAttempts(ip)) return send(res, 429, { error: 'Muitas tentativas. Espere 1 minuto.' });
      const b = await readJson(req);
      const r = restaurants.find((x) => x.email.toLowerCase() === String(b.email || '').trim().toLowerCase());
      if (!r || !b.password || !checkPassword(String(b.password), r.passwordHash)) {
        failAttempt(ip);
        return send(res, 401, { error: 'E-mail ou senha incorretos.' });
      }
      const token = createSession(r.id);
      return send(res, 200, { ok: true }, { 'Set-Cookie': cookie(token, SESSION_DAYS * 86400) });
    }
    if (p === '/api/logout' && req.method === 'POST') {
      if (session) sessions.delete(session.token);
      return send(res, 200, { ok: true }, { 'Set-Cookie': cookie('', 0) });
    }

    // --- app do motoboy (identificado pelo código da loja) ---
    if (p === '/api/loja' && req.method === 'GET') {
      const r = byCode(url.searchParams.get('codigo'));
      return r ? send(res, 200, { name: r.name }) : send(res, 404, { error: 'Código da loja inválido.' });
    }
    if (p === '/api/location' && req.method === 'POST') {
      const b = await readJson(req);
      const r = byCode(b.code);
      if (!r) return send(res, 404, { error: 'Código da loja inválido.' });
      const lat = Number(b.lat), lng = Number(b.lng);
      if (!b.id || !Number.isFinite(lat) || !Number.isFinite(lng)) return send(res, 400, { error: 'id, lat e lng são obrigatórios' });
      const patch = { lat, lng, speed: Number(b.speed) || 0, heading: Number(b.heading) || 0, accuracy: b.accuracy ?? null };
      if (b.name) patch.name = String(b.name).slice(0, 40);
      if (b.phone) patch.phone = String(b.phone).slice(0, 20);
      if (VALID_STATUS.has(b.status)) patch.status = b.status;
      const d = upsertDriver(r.id, String(b.id).slice(0, 64), patch);
      return send(res, 200, { ok: true, status: d.status, order: d.order, loja: r.name });
    }

    // --- painel da loja (precisa de login) ---
    if (p.startsWith('/api/')) {
      if (!session) return send(res, 401, { error: 'Faça login.' });
      const rid = session.restaurant.id;

      if (p === '/api/me') return send(res, 200, publicRestaurant(session.restaurant));
      if (p === '/api/stream') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        res.write(`data: ${JSON.stringify(snapshot(rid))}\n\n`);
        const c = { res, rid };
        clients.add(c);
        req.on('close', () => clients.delete(c));
        return;
      }
      if (p === '/api/drivers' && req.method === 'GET') return send(res, 200, snapshot(rid));

      const m = p.match(/^\/api\/drivers\/([^/]+)$/);
      if (m && (req.method === 'PATCH' || req.method === 'DELETE')) {
        const id = decodeURIComponent(m[1]);
        const cur = drivers.get(key(rid, id));
        if (!cur) return send(res, 404, { error: 'motoboy não encontrado' });
        if (req.method === 'DELETE') { drivers.delete(key(rid, id)); broadcast(); return send(res, 200, { ok: true }); }
        const b = await readJson(req);
        const patch = {};
        if (VALID_STATUS.has(b.status)) patch.status = b.status;
        if (typeof b.order === 'string') patch.order = b.order.slice(0, 60);
        if (patch.status === 'disponivel' && cur.status === 'entrega') {
          patch.deliveriesToday = cur.deliveriesToday + 1;
          patch.order = '';
        }
        const { rid: _r, ...d } = upsertDriver(rid, id, patch);
        return send(res, 200, d);
      }
      return send(res, 404, { error: 'não encontrado' });
    }

    // --- páginas ---
    if (p === '/' || p === '/index.html') {
      if (!session) return redirect(res, '/login.html');
      return serveFile(res, path.join(PUBLIC, 'index.html'));
    }
    if (p === '/login' || p === '/login.html') {
      if (session) return redirect(res, '/');
      return serveFile(res, path.join(PUBLIC, 'login.html'));
    }
    const file = path.normalize(path.join(PUBLIC, p));
    if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, { error: 'proibido' });
    return serveFile(res, file);
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

// ---------- Simulador (motoboys de demonstração na loja demo) ----------
function randomPointNear(lat, lng, km) {
  const r = (km / 111) * Math.sqrt(Math.random());
  const t = Math.random() * 2 * Math.PI;
  return [lat + r * Math.cos(t), lng + (r * Math.sin(t)) / Math.cos((lat * Math.PI) / 180)];
}

function startSimulator(R) {
  const names = [['Carlos Silva', '(11) 98888-1001'], ['João Pereira', '(11) 98888-1002'], ['Rafael Souza', '(11) 98888-1003'], ['Marcos Lima', '(11) 98888-1004'], ['Bruno Costa', '(11) 98888-1005']];
  const sims = names.map(([name, phone], i) => {
    const [lat, lng] = randomPointNear(R.lat, R.lng, 1.5);
    const id = `sim-${i + 1}`;
    upsertDriver(R.id, id, { name, phone, lat, lng, simulated: true, status: i === 4 ? 'pausa' : i % 2 ? 'entrega' : 'disponivel', order: i % 2 ? `#${1040 + i}` : '', deliveriesToday: Math.floor(Math.random() * 8) });
    return { id, target: randomPointNear(R.lat, R.lng, 3.5), kmh: 25 + Math.random() * 20 };
  });

  const TICK = 2000;
  setInterval(() => {
    for (const s of sims) {
      const d = drivers.get(key(R.id, s.id));
      if (!d) continue;
      if (d.status === 'pausa') { upsertDriver(R.id, s.id, { lat: d.lat, lng: d.lng, speed: 0 }); continue; }
      const [tLat, tLng] = d.status === 'disponivel' ? [R.lat, R.lng] : s.target;
      const dLat = tLat - d.lat, dLng = tLng - d.lng;
      const distDeg = Math.hypot(dLat, dLng);
      const step = ((s.kmh / 3600) * (TICK / 1000)) / 111 * 6; // acelerado 6x para a demo
      if (distDeg < step) {
        if (d.status === 'entrega') {
          upsertDriver(R.id, s.id, { lat: tLat, lng: tLng, speed: 0, status: 'disponivel', order: '', deliveriesToday: d.deliveriesToday + 1 });
        } else {
          s.target = randomPointNear(R.lat, R.lng, 3.5);
          upsertDriver(R.id, s.id, { lat: tLat, lng: tLng, speed: 0, status: 'entrega', order: `#${1050 + Math.floor(Math.random() * 900)}` });
        }
        continue;
      }
      const jitter = (Math.random() - 0.5) * step * 0.6;
      const lat = d.lat + (dLat / distDeg) * step + jitter;
      const lng = d.lng + (dLng / distDeg) * step - jitter;
      const heading = (Math.atan2(dLng, dLat) * 180) / Math.PI;
      upsertDriver(R.id, s.id, { lat, lng, speed: s.kmh / 3.6, heading: (heading + 360) % 360 });
    }
  }, TICK);
}

loadRestaurants();
server.listen(PORT, () => {
  console.log(`Login da loja:   http://localhost:${PORT}/login.html`);
  console.log(`App do motoboy:  http://localhost:${PORT}/motoboy.html`);
  const demo = restaurants.find((r) => r.demo);
  if (SIMULATE && demo) { startSimulator(demo); console.log('Simulador ligado na loja demo. Use SIMULATE=0 para desligar.'); }
});
