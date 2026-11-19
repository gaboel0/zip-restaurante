<template>
  <div class="app">
    <aside ref="aside">
      <header>
        <div class="brand a-in">
          <BrandLogo />
          <b>ZipRotas</b>
          <button class="btn btn-ghost logout" @click="logout">Sair</button>
        </div>
        <div class="store a-in">{{ state.restaurant?.name || 'Carregando…' }}</div>
        <div class="sub a-in">
          <span class="live" :class="{ off: !live }">{{ live ? 'ao vivo' : 'reconectando…' }}</span>
          · <span>{{ clock }}</span>
        </div>
      </header>

      <div class="stats a-in">
        <StatTile v-for="s in statDefs" :key="s.f" :value="counts[s.f]" :label="s.label" :color="s.color"
                  :active="filter === s.f" @click="filter = s.f" />
      </div>

      <div class="search a-in">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input v-model="q" placeholder="Buscar motoboy ou pedido…">
      </div>

      <div class="list">
        <TransitionGroup name="list" :css="true" @enter="cardEnter">
          <DriverCard v-for="d in list" :key="d.id" :d="d" :restaurant="state.restaurant" :now="now"
                      :selected="selectedId === d.id" :following="follow && selectedId === d.id"
                      @toggle="toggle(d.id)" @assign="(o) => assign(d.id, o)" @status="(s) => setStatus(d.id, s)"
                      @follow="follow = !follow" @remove="remove(d.id)" />
        </TransitionGroup>
        <div v-if="!list.length" class="empty">
          <template v-if="state.drivers.length">Nenhum motoboy neste filtro.</template>
          <template v-else>Nenhum motoboy conectado ainda.</template>
        </div>
      </div>
    </aside>

    <LiveMap :drivers="state.drivers" :restaurant="state.restaurant" :selected-id="selectedId" :follow="follow"
             @select="(id) => select(id)" @stop-follow="follow = false" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { animate, stagger } from 'animejs';
import BrandLogo from '../components/BrandLogo.vue';
import StatTile from '../components/StatTile.vue';
import DriverCard from '../components/DriverCard.vue';
import LiveMap from '../components/LiveMap.vue';
import { api, effStatus } from '../lib/api.js';
import { useStream } from '../lib/useStream.js';
import { reducedMotion } from '../lib/motion.js';

const router = useRouter();
const { state, live } = useStream();

const filter = ref('todos');
const q = ref('');
const selectedId = ref(null);
const follow = ref(false);
const now = ref(Date.now());
const clock = ref('');
const aside = ref(null);

const statDefs = [
  { f: 'todos', label: 'Todos', color: 'var(--title)' },
  { f: 'disponivel', label: 'Livres', color: 'var(--green-lt)' },
  { f: 'entrega', label: 'Entregando', color: 'var(--red-text)' },
  { f: 'offline', label: 'Offline', color: '#9a9aa2' },
];

const counts = computed(() => {
  const c = { todos: state.drivers.length, disponivel: 0, entrega: 0, pausa: 0, offline: 0 };
  state.drivers.forEach((d) => { c[effStatus(d)]++; });
  return c;
});

const ORDER = { entrega: 0, disponivel: 1, pausa: 2, offline: 3 };
const list = computed(() => {
  const term = q.value.trim().toLowerCase();
  return state.drivers
    .filter((d) => filter.value === 'todos' || effStatus(d) === filter.value)
    .filter((d) => !term || d.name.toLowerCase().includes(term) || (d.order || '').toLowerCase().includes(term))
    .sort((a, b) => ORDER[effStatus(a)] - ORDER[effStatus(b)] || a.name.localeCompare(b.name));
});

// entrada dos cartões em cascata
let enterIndex = 0, enterTimer;
function cardEnter(el) {
  if (reducedMotion()) return;
  const i = enterIndex++;
  clearTimeout(enterTimer);
  enterTimer = setTimeout(() => { enterIndex = 0; }, 50);
  animate(el, { opacity: [0, 1], x: [-16, 0], duration: 500, delay: i * 45, ease: 'outExpo' });
}

function toggle(id) {
  selectedId.value = selectedId.value === id ? null : id;
  if (!selectedId.value) follow.value = false;
}
function select(id) {
  selectedId.value = id;
  requestAnimationFrame(() => document.querySelector('.driver.sel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
}
watch(selectedId, (v) => { if (!v) follow.value = false; });

const assign = (id, order) => api.updateDriver(id, { status: 'entrega', order: (order || '').trim() });
const setStatus = (id, status) => api.updateDriver(id, { status });
async function remove(id) {
  if (!confirm('Remover este motoboy do painel?')) return;
  selectedId.value = null;
  await api.removeDriver(id);
}

async function logout() {
  await api.logout().catch(() => {});
  router.replace('/login');
}

watch(() => state.restaurant?.name, (n) => { if (n) document.title = `${n} · ZipRotas`; });

let tick;
onMounted(() => {
  const update = () => { now.value = Date.now(); clock.value = new Date().toLocaleTimeString('pt-BR'); };
  update();
  tick = setInterval(update, 1000);
  if (!reducedMotion()) {
    animate(aside.value.querySelectorAll('.a-in'), { opacity: [0, 1], y: [12, 0], duration: 600, delay: stagger(60), ease: 'outExpo' });
  }
});
onBeforeUnmount(() => { clearInterval(tick); document.title = 'ZipRotas'; });
</script>

<style scoped>
.app { display: grid; grid-template-columns: 390px 1fr; height: 100vh; }
aside { background: var(--panel); border-right: 1px solid var(--line); display: flex; flex-direction: column; min-height: 0; z-index: 2; }
header { padding: 16px 18px 14px; border-bottom: 1px solid var(--line); }
.brand { display: flex; align-items: center; gap: 10px; }
.brand b { color: var(--title); font-weight: 800; letter-spacing: -0.02em; font-size: 17px; }
.logout { margin-left: auto; font-size: 12px; padding: 6px 11px; border-radius: 10px; }
.store { color: var(--title); font-size: 20px; font-weight: 800; letter-spacing: -0.03em; margin: 14px 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sub { color: var(--muted); font-size: 12px; display: flex; gap: 8px; align-items: center; }
.live { color: var(--green-lt); font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }
.live::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; animation: blink 1.8s infinite; }
.live.off { color: var(--red); }
@keyframes blink { 50% { box-shadow: 0 0 0 4px #2fca7822; } }

.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 14px 18px; }

.search { margin: 0 18px 12px; position: relative; }
.search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; stroke: var(--muted); }
.search input { width: 100%; padding: 11px 12px 11px 36px; border-radius: var(--radius); border: 1px solid var(--line); background: var(--card); color: var(--title); font-size: 13px; outline: none; transition: border-color .2s; }
.search input:focus { border-color: var(--red); }
.search input::placeholder { color: var(--muted); }

.list { overflow-y: auto; overflow-x: hidden; padding: 0 12px 16px; flex: 1; position: relative; scrollbar-width: thin; scrollbar-color: var(--line) transparent; }
.list-move { transition: transform .5s cubic-bezier(0.23, 1, 0.32, 1); }
.list-leave-active { transition: opacity .2s, transform .2s; position: absolute; left: 12px; right: 12px; }
.list-leave-to { opacity: 0; transform: translateX(-12px); }
.empty { color: var(--muted); text-align: center; padding: 30px 10px; font-size: 13px; line-height: 1.5; }


@media (max-width: 760px) {
  .app { grid-template-columns: 1fr; grid-template-rows: 45vh 1fr; }
  aside { order: 2; border-right: 0; border-top: 1px solid var(--line); }
}
</style>
