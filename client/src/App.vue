<template>
  <RouterView v-slot="{ Component, route }">
    <Transition :css="false" mode="out-in" @enter="onEnter" @leave="onLeave">
      <component :is="Component" :key="route.meta.auth_screen ? 'auth' : route.path" />
    </Transition>
  </RouterView>
</template>

<script setup>
import { animate } from 'animejs';
import { reducedMotion } from './lib/motion.js';

// transição suave entre telas
function onEnter(el, done) {
  if (reducedMotion()) return done();
  animate(el, { opacity: [0, 1], duration: 350, ease: 'outQuad', onComplete: done });
}
function onLeave(el, done) {
  if (reducedMotion()) return done();
  animate(el, { opacity: [1, 0], duration: 200, ease: 'inQuad', onComplete: done });
}
</script>
