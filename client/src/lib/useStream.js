import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, IS_DEMO } from './api.js';
import { subscribe } from './demoBackend.js';

// Recebe o estado da loja em tempo real (Server-Sent Events, ou o simulador no modo demo).
export function useStream() {
  const router = useRouter();
  const state = reactive({ restaurant: null, drivers: [], serverTime: 0 });
  const live = ref(false);
  let es = null;
  let unsubscribe = null;

  const apply = (data) => {
    state.restaurant = data.restaurant;
    state.drivers = data.drivers;
    state.serverTime = data.serverTime;
    live.value = true;
  };

  function connect() {
    if (IS_DEMO) { unsubscribe = subscribe(apply); return; }
    es = new EventSource('/api/stream');
    es.onopen = () => { live.value = true; };
    es.onmessage = (ev) => apply(JSON.parse(ev.data));
    es.onerror = async () => {
      live.value = false;
      try { await api.me(); } catch (e) {
        if (e.status === 401 || e.status === 503) { es.close(); router.replace('/login'); }
      }
    };
  }

  onMounted(connect);
  onBeforeUnmount(() => { es?.close(); unsubscribe?.(); });
  return { state, live };
}
