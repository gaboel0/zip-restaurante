<template>
  <main class="login">
    <section class="scene">
      <CityScene />
      <div class="scene-fade"></div>
      <div class="scene-caption">
        <span class="dot"></span> Acompanhe seus motoboys em tempo real
      </div>
    </section>

    <section class="side">
      <div class="box" ref="box">
        <div class="brand a-in"><BrandLogo /><b>ZipRotas</b></div>

        <form class="card" ref="card" novalidate @submit.prevent="submit">
          <h1 ref="title" :key="mode">{{ isRegister ? 'Criar conta da loja' : 'Entrar no painel da loja' }}</h1>
          <p class="sub a-in">{{ isRegister ? 'Leva menos de um minuto.' : 'Use o e-mail e a senha do restaurante.' }}</p>
          <p v-if="IS_DEMO && !isRegister" class="demo-hint a-in">Versão de demonstração: os dados já estão preenchidos, é só clicar em Entrar.</p>

          <div v-if="isRegister" class="a-in">
            <label class="label" for="name">Nome do restaurante</label>
            <input id="name" v-model.trim="name" class="input" autocomplete="organization" placeholder="Ex.: Pizzaria do Bairro">
          </div>

          <div class="a-in">
            <label class="label" for="email">E-mail</label>
            <input id="email" v-model.trim="email" class="input" type="email" autocomplete="username" placeholder="voce@restaurante.com">
          </div>

          <div class="a-in">
            <label class="label" for="password">Senha</label>
            <div class="field">
              <input id="password" v-model="password" class="input" :type="show ? 'text' : 'password'"
                     :autocomplete="isRegister ? 'new-password' : 'current-password'"
                     :placeholder="isRegister ? 'Mínimo de 8 caracteres' : 'Sua senha'">
              <button type="button" class="toggle" @click="show = !show">{{ show ? 'Ocultar' : 'Mostrar' }}</button>
            </div>
            <div v-if="isRegister && password" class="strength">
              <i v-for="n in 4" :key="n" :class="{ on: n <= strength }" :style="{ '--c': strengthColor }"></i>
              <span>{{ strengthLabel }}</span>
            </div>
          </div>

          <div v-if="isRegister" class="a-in">
            <label class="label" for="password2">Confirmar senha</label>
            <input id="password2" v-model="password2" class="input" :type="show ? 'text' : 'password'" autocomplete="new-password" placeholder="Repita a senha">
          </div>

          <div v-if="isRegister" class="a-in loc">
            <button type="button" class="btn btn-ghost loc-btn" :disabled="locating" @click="useLocation">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.4" /></svg>
              {{ locating ? 'Obtendo localização…' : coords ? 'Localização da loja salva ✓' : 'Usar minha localização como endereço da loja' }}
            </button>
            <p class="hint">Opcional. Se pular, a loja aparece num ponto padrão em São Paulo.</p>
          </div>

          <button class="btn btn-red submit a-in" type="submit" :disabled="loading">
            <span v-if="!loading">{{ isRegister ? 'Criar conta' : 'Entrar' }}</span>
            <span v-else class="spinner" aria-label="Enviando"></span>
          </button>
          <div v-if="error" ref="errEl" class="err-box" role="alert">{{ error }}</div>
        </form>

        <p class="switch a-in">
          <template v-if="isRegister">Já tem conta? <RouterLink to="/login">Entrar</RouterLink></template>
          <template v-else>Ainda não tem conta? <RouterLink to="/cadastro">Criar conta da loja</RouterLink></template>
        </p>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { animate, stagger, splitText } from 'animejs';
import CityScene from '../components/CityScene.vue';
import BrandLogo from '../components/BrandLogo.vue';
import { api, IS_DEMO } from '../lib/api.js';
import { reducedMotion } from '../lib/motion.js';

const route = useRoute();
const router = useRouter();
const mode = computed(() => (route.name === 'cadastro' ? 'cadastro' : 'login'));
const isRegister = computed(() => mode.value === 'cadastro');

const name = ref('');
const email = ref(IS_DEMO ? 'loja@demo.test' : '');
const password = ref(IS_DEMO ? 'demonstracao' : '');
const password2 = ref('');
const show = ref(false);
const loading = ref(false);
const locating = ref(false);
const coords = ref(null);
const error = ref('');
const box = ref(null), card = ref(null), title = ref(null), errEl = ref(null);

const strength = computed(() => {
  const p = password.value;
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) s++;
  return s;
});
const strengthLabel = computed(() => ['Muito fraca', 'Fraca', 'Média', 'Boa', 'Forte'][strength.value]);
const strengthColor = computed(() => ['#ea1d2c', '#ea1d2c', '#f5a524', '#2fca78', '#2fca78'][strength.value]);

function intro() {
  if (reducedMotion() || !title.value) return;
  const { chars } = splitText(title.value, { chars: true });
  animate(chars, { opacity: [0, 1], y: ['0.5em', '0em'], duration: 500, delay: stagger(14, { start: 150 }), ease: 'outExpo' });
  animate(box.value.querySelectorAll('.a-in'), { opacity: [0, 1], y: [14, 0], duration: 600, delay: stagger(60, { start: 80 }), ease: 'outExpo' });
}

onMounted(() => {
  if (!reducedMotion()) animate(card.value, { scale: [0.97, 1], opacity: [0, 1], duration: 700, ease: 'outExpo' });
  intro();
});

// troca login <-> cadastro sem recarregar a cena 3D
watch(mode, async () => {
  error.value = '';
  password.value = ''; password2.value = '';
  await nextTick();
  intro();
});

function useLocation() {
  if (!('geolocation' in navigator)) { error.value = 'Seu navegador não permite pegar a localização.'; return; }
  locating.value = true;
  navigator.geolocation.getCurrentPosition(
    (p) => { coords.value = { lat: p.coords.latitude, lng: p.coords.longitude }; locating.value = false; },
    () => { locating.value = false; error.value = 'Não deu para pegar a localização. Você pode pular essa etapa.'; },
    { enableHighAccuracy: true, timeout: 15000 },
  );
}

async function submit() {
  error.value = '';
  if (isRegister.value) {
    if (name.value.length < 2) return fail('Digite o nome do restaurante.');
    if (!email.value) return fail('Digite o e-mail.');
    if (password.value.length < 8) return fail('A senha precisa ter pelo menos 8 caracteres.');
    if (password.value !== password2.value) return fail('As senhas não são iguais.');
  } else if (!email.value || !password.value) {
    return fail('Preencha e-mail e senha.');
  }
  loading.value = true;
  try {
    if (isRegister.value) await api.register({ name: name.value, email: email.value, password: password.value, ...(coords.value || {}) });
    else await api.login(email.value, password.value);
    if (!reducedMotion()) {
      await new Promise((done) => animate(card.value, { scale: [1, 0.98], opacity: [1, 0], duration: 250, ease: 'inQuad', onComplete: done }));
    }
    router.replace('/');
  } catch (e) {
    fail(e.message === 'Failed to fetch' ? 'Sem conexão com o servidor.' : e.message);
  } finally {
    loading.value = false;
  }
}

async function fail(msg) {
  error.value = msg;
  await nextTick();
  if (reducedMotion()) return;
  animate(card.value, { x: [0, -10, 9, -6, 4, 0], duration: 420, ease: 'outQuad' });
  if (errEl.value) animate(errEl.value, { opacity: [0, 1], y: [-6, 0], duration: 300, ease: 'outQuad' });
}
</script>

<style scoped>
.login { display: grid; grid-template-columns: 1.15fr 1fr; height: 100vh; min-height: 600px; background: var(--page); }
.scene { position: relative; overflow: hidden; }
.scene-fade { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(90deg, transparent 70%, var(--page)), linear-gradient(0deg, #1a1a1cdd, transparent 30%); }
.scene-caption { position: absolute; left: 28px; bottom: 26px; display: flex; align-items: center; gap: 10px; color: var(--text); font-size: 14px; font-weight: 600; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green-lt); box-shadow: 0 0 0 4px #2fca7830; animation: pulse 1.8s infinite; }
@keyframes pulse { 50% { box-shadow: 0 0 0 7px #2fca7810; } }

.side { display: grid; place-items: center; padding: 24px 16px; overflow-y: auto; }
.box { width: 100%; max-width: 380px; }
.brand { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; }
.brand b { color: var(--title); font-weight: 800; font-size: 19px; letter-spacing: -0.02em; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 26px 22px 22px; box-shadow: 0 30px 80px #0006; }
h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.03em; color: var(--title); margin: 0 0 4px; }
h1 :deep(span) { display: inline-block; }
.sub { color: var(--muted); font-size: 13px; margin: 0 0 6px; }
.demo-hint { margin: 10px 0 2px; padding: 9px 11px; border-radius: 10px; background: var(--green-soft); color: var(--green-lt); font-size: 12px; font-weight: 600; }
.field { position: relative; }
.toggle { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: none; border: 0; color: var(--muted); font-size: 12px; font-weight: 700; cursor: pointer; padding: 8px; border-radius: 8px; }
.toggle:hover { color: var(--title); }

.strength { display: flex; align-items: center; gap: 4px; margin-top: 8px; }
.strength i { flex: 1; height: 4px; border-radius: 4px; background: var(--line); transition: background .3s; }
.strength i.on { background: var(--c); }
.strength span { margin-left: 8px; font-size: 11px; font-weight: 700; color: var(--muted); white-space: nowrap; min-width: 66px; }

.loc { margin-top: 16px; }
.loc-btn { width: 100%; display: flex; align-items: center; gap: 8px; justify-content: center; padding: 11px; font-size: 13px; color: var(--text); }
.loc-btn svg { width: 16px; height: 16px; color: var(--red); flex: none; }
.hint { color: var(--muted); font-size: 11px; margin: 6px 0 0; text-align: center; }

.submit { width: 100%; margin-top: 20px; padding: 14px; font-size: 15px; height: 50px; display: grid; place-items: center; }
.spinner { width: 18px; height: 18px; border-radius: 50%; border: 2.5px solid #ffffff55; border-top-color: #fff; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.switch { text-align: center; margin-top: 18px; font-size: 14px; color: var(--muted); }
.switch a { color: var(--title); font-weight: 700; text-decoration: none; border-bottom: 2px solid var(--red); padding-bottom: 1px; transition: color .2s; }
.switch a:hover { color: var(--red); }

@media (max-width: 860px) {
  .login { grid-template-columns: 1fr; position: relative; }
  .scene { position: absolute; inset: 0; opacity: .55; }
  .scene-fade { background: linear-gradient(0deg, var(--page) 10%, transparent 70%); }
  .scene-caption { display: none; }
  .side { position: relative; z-index: 1; }
}
</style>
