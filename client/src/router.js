import { createMemoryHistory, createRouter, createWebHistory } from 'vue-router';
import { api } from './lib/api.js';

const routes = [
  { path: '/', name: 'painel', component: () => import('./views/PainelView.vue'), meta: { auth: true } },
  { path: '/login', name: 'login', component: () => import('./views/LoginView.vue'), meta: { guest: true, auth_screen: true } },
  { path: '/cadastro', name: 'cadastro', component: () => import('./views/LoginView.vue'), meta: { guest: true, auth_screen: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

// No artefato (modo demo) a URL não pode mudar, então a navegação fica só na memória.
const history = import.meta.env.VITE_DEMO === '1' ? createMemoryHistory() : createWebHistory();
const router = createRouter({ history, routes });

router.beforeEach(async (to) => {
  if (!to.meta.auth && !to.meta.guest) return true;
  let logged = false;
  try { await api.me(); logged = true; } catch { logged = false; }
  if (to.meta.auth && !logged) return { name: 'login' };
  if (to.meta.guest && logged) return { name: 'painel' };
  return true;
});

export default router;
