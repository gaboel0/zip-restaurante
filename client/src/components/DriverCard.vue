<template>
  <article class="driver" :class="{ sel: selected }" @click="$emit('toggle')">
    <div class="row">
      <div class="avatar" :style="{ background: STATUS[st].color }">{{ initials(d.name) }}</div>
      <div class="who">
        <div class="name">{{ d.name }} <small v-if="d.simulated">(demo)</small></div>
        <div class="meta"><template v-if="d.order">📦 {{ d.order }} · </template>{{ distance }}</div>
      </div>
      <span class="badge" :class="'b-' + st">{{ STATUS[st].label }}</span>
    </div>

    <Transition :css="false" @enter="open" @leave="close">
      <div v-if="selected" class="details" @click.stop>
        <div class="grid2">
          <div>Velocidade<b>{{ Math.round((d.speed || 0) * 3.6) }} km/h</b></div>
          <div>Última posição<b>{{ ago(d.updatedAt, now) }}</b></div>
          <div>Entregas hoje<b>{{ d.deliveriesToday || 0 }}</b></div>
          <div>Telefone<b><a v-if="d.phone" :href="'tel:' + d.phone">{{ d.phone }}</a><template v-else>—</template></b></div>
        </div>
        <div class="actions">
          <input v-model="order" class="order" placeholder="Nº do pedido" @keydown.enter="$emit('assign', order)">
          <button class="primary" @click="$emit('assign', order)">Enviar p/ entrega</button>
          <button @click="$emit('status', 'disponivel')">Marcar livre</button>
          <button @click="$emit('status', 'pausa')">Pausa</button>
          <button @click="$emit('follow')">{{ following ? 'Parar de seguir' : 'Seguir no mapa' }}</button>
          <button v-if="!d.simulated" @click="$emit('remove')">Remover</button>
        </div>
      </div>
    </Transition>
  </article>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { animate } from 'animejs';
import { STATUS, effStatus, initials, km, ago } from '../lib/api.js';
import { reducedMotion } from '../lib/motion.js';

const props = defineProps({ d: Object, restaurant: Object, selected: Boolean, following: Boolean, now: Number });
defineEmits(['toggle', 'assign', 'status', 'follow', 'remove']);

const st = computed(() => effStatus(props.d));
const distance = computed(() => (props.restaurant && props.d.lat != null
  ? `${km(props.restaurant, props.d).toFixed(1)} km do restaurante` : 'sem localização'));

const order = ref(props.d.order || '');
watch(() => props.d.order, (v) => { order.value = v || ''; });

function open(el, done) {
  if (reducedMotion()) return done();
  const h = el.scrollHeight;
  el.style.overflow = 'hidden';
  animate(el, { height: [0, h], opacity: [0, 1], duration: 380, ease: 'outExpo', onComplete: () => { el.style.height = ''; el.style.overflow = ''; done(); } });
}
function close(el, done) {
  if (reducedMotion()) return done();
  el.style.overflow = 'hidden';
  animate(el, { height: [el.scrollHeight, 0], opacity: [1, 0], duration: 240, ease: 'inQuad', onComplete: done });
}
</script>

<style scoped>
.driver { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 12px; margin: 0 6px 8px; cursor: pointer; transition: border-color .2s, background .2s; }
.driver:hover { background: var(--card-hover); }
.driver.sel { border-color: var(--red); }
.row { display: flex; align-items: center; gap: 10px; }
.avatar { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; font-weight: 800; font-size: 13px; color: #fff; flex: none; transition: background .4s; }
.who { min-width: 0; }
.name { font-weight: 700; font-size: 14px; color: var(--title); }
.name small { color: var(--muted); font-weight: 400; font-size: 11px; }
.meta { color: var(--muted); font-size: 12px; margin-top: 2px; }
.badge { margin-left: auto; }
.details { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 12px; cursor: default; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; color: var(--muted); }
.grid2 b { display: block; color: var(--title); font-weight: 700; font-size: 13px; margin-top: 1px; }
.grid2 a { color: var(--red-text); }
.actions { display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap; }
.actions button, .actions input { font-size: 12px; font-weight: 700; border-radius: 10px; border: 1px solid var(--line); background: #232327; color: var(--text); padding: 8px 10px; cursor: pointer; transition: border-color .2s, background .2s; }
.actions input { cursor: text; flex: 1; min-width: 90px; font-weight: 500; color: var(--title); outline: none; }
.actions input:focus { border-color: var(--red); }
.actions button:hover { border-color: #4a4a52; }
.actions .primary { background: var(--red); border-color: var(--red); color: #fff; }
.actions .primary:hover { background: var(--red-press); border-color: var(--red-press); }
</style>
