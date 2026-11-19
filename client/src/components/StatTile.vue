<template>
  <button class="stat" :class="{ active }" type="button">
    <b ref="num" :style="{ color }">{{ shown }}</b>
    <span>{{ label }}</span>
  </button>
</template>

<script setup>
import { ref, watch } from 'vue';
import { animate, utils } from 'animejs';
import { reducedMotion } from '../lib/motion.js';

const props = defineProps({ value: Number, label: String, color: String, active: Boolean });
const shown = ref(0);
const num = ref(null);
const counter = { v: 0 };
let anim;

watch(() => props.value, (to, from) => {
  anim?.pause();
  if (reducedMotion()) { shown.value = to; return; }
  anim = animate(counter, {
    v: to, duration: 700, ease: 'outExpo', modifier: utils.round(0),
    onUpdate: () => { shown.value = counter.v; },
  });
  if (from != null && to !== from && num.value) animate(num.value, { scale: [1.25, 1], duration: 500, ease: 'outBack' });
}, { immediate: true });
</script>

<style scoped>
.stat { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 10px 6px; text-align: center; cursor: pointer; color: inherit; transition: border-color .2s, transform .2s, background .2s; }
.stat:hover { transform: translateY(-2px); background: var(--card-hover); }
.stat.active { border-color: var(--red); box-shadow: inset 0 0 0 1px var(--red); }
b { display: block; font-size: 22px; font-weight: 800; letter-spacing: var(--tracking); color: var(--title); }
span { font-size: 11px; color: var(--muted); font-weight: 600; }
</style>
