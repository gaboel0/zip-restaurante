import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from './api.js';

// Recebe o estado da loja em tempo real (Server-Sent Events).
export function useStream() {
  const router = useRouter();
  const state = reactive({ restaurant: null, drivers: [], serverTime: 0 });
  const live = ref(false);
  let es = null;

  function connect() {
    es = new EventSource('/api/stream');
    es.onopen = () => { live.value = true; };
    es.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      state.restaurant = data.restaurant;
      state.drivers = data.drivers;
      state.serverTime = data.serverTime;
      live.value = true;
    };
    es.onerror = async () => {
      live.value = false;
      try { await api.me(); } catch (e) {
        if (e.status === 401) { es.close(); router.replace('/login'); }
      }
    };
  }

  onMounted(connect);
  onBeforeUnmount(() => es?.close());
  return { state, live };
}
