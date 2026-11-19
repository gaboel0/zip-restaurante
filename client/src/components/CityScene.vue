<template>
  <div ref="host" class="city-scene" aria-hidden="true"></div>
</template>

<script setup>
// Cena 3D: bairro à noite com motoboys (pontos de luz) percorrendo as ruas
// a partir do restaurante, desenhando as rotas em vermelho.
import { onMounted, onBeforeUnmount, ref } from 'vue';
import * as THREE from 'three';
import { reducedMotion } from '../lib/motion.js';

const host = ref(null);
let cleanup = () => {};

const RED = 0xea1d2c, GREEN = 0x2fca78, AMBER = 0xf5a524;
const GRID = 6;      // quarteirões de -GRID..GRID
const CELL = 2;      // distância entre centros de quarteirão

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// cruzamentos ficam nas coordenadas ímpares (ruas entre quarteirões)
const randStreet = () => (Math.floor(Math.random() * GRID * 2) - GRID) * CELL + CELL / 2;

function manhattan(from, to) {
  const pts = [from.clone()];
  if (Math.random() < 0.5) pts.push(new THREE.Vector3(to.x, 0, from.z));
  else pts.push(new THREE.Vector3(from.x, 0, to.z));
  pts.push(to.clone());
  return pts.filter((p, i) => i === 0 || !p.equals(pts[i - 1]));
}

onMounted(() => {
  const el = host.value;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x1a1a1c);
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x1a1a1c, 24, 52);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const world = new THREE.Group();
  scene.add(world);

  // luzes
  scene.add(new THREE.HemisphereLight(0x8a8a9a, 0x101012, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(-8, 14, 6);
  scene.add(sun);
  const storeLight = new THREE.PointLight(RED, 18, 7, 1.8);
  storeLight.position.set(0, 2.2, 0);
  world.add(storeLight);

  // chão (asfalto)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0x17171a, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  world.add(ground);

  // quarteirões (instanciados)
  const blocks = [];
  for (let i = -GRID; i <= GRID; i++) for (let j = -GRID; j <= GRID; j++) {
    if (i === 0 && j === 0) continue; // restaurante
    blocks.push([i * CELL, j * CELL, 0.2 + Math.random() ** 2.5 * 1.8]);
  }
  const blockGeo = new THREE.BoxGeometry(1.42, 1, 1.42);
  blockGeo.translate(0, 0.5, 0);
  const blockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.05 });
  const inst = new THREE.InstancedMesh(blockGeo, blockMat, blocks.length);
  const m = new THREE.Matrix4(), col = new THREE.Color();
  blocks.forEach(([x, z, h], k) => {
    m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1));
    inst.setMatrixAt(k, m);
    inst.setColorAt(k, col.setHSL(0.66, 0.04, 0.16 + Math.random() * 0.07));
  });
  world.add(inst);

  // restaurante: base escura + anel pulsante + pino
  const store = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.5, 1.42), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 }));
  base.position.y = 0.25;
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), new THREE.MeshStandardMaterial({ color: RED, emissive: RED, emissiveIntensity: 1.4 }));
  pin.position.y = 1.4;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 48), new THREE.MeshBasicMaterial({ color: RED, transparent: true, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  store.add(base, pin, ring);
  world.add(store);

  // motoboys
  const glow = glowTexture();
  const origin = new THREE.Vector3(CELL / 2, 0, CELL / 2);
  const colors = [RED, RED, RED, GREEN, GREEN, AMBER, RED];
  const riders = colors.map((c, i) => {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshBasicMaterial({ color: c }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(1.3, 1.3, 1);
    dot.add(halo);
    dot.position.y = 0.15;
    world.add(dot);
    const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.75 }));
    line.position.y = 0.04;
    world.add(line);
    const r = { dot, line, path: [], lengths: [], total: 0, d: 0, speed: 2.2 + Math.random() * 1.4, outbound: i % 2 === 0, pos: origin.clone() };
    newRoute(r, true);
    r.d = Math.random() * r.total;
    return r;
  });

  function newRoute(r, first) {
    const from = first ? origin.clone() : r.pos.clone();
    const to = r.outbound ? new THREE.Vector3(randStreet(), 0, randStreet()) : origin.clone();
    r.path = manhattan(from, to);
    if (r.path.length < 2) r.path.push(new THREE.Vector3(randStreet(), 0, randStreet()));
    r.lengths = r.path.slice(1).map((p, k) => p.distanceTo(r.path[k]));
    r.total = r.lengths.reduce((a, b) => a + b, 0);
    r.d = 0;
    r.line.geometry.dispose();
    r.line.geometry = new THREE.BufferGeometry().setFromPoints(r.path);
  }

  function place(r) {
    let d = r.d, k = 0;
    while (k < r.lengths.length - 1 && d > r.lengths[k]) { d -= r.lengths[k]; k++; }
    const t = r.lengths[k] ? Math.min(1, d / r.lengths[k]) : 1;
    r.pos.lerpVectors(r.path[k], r.path[k + 1], t);
    r.dot.position.set(r.pos.x, 0.15, r.pos.z);
  }

  // tamanho
  function resize() {
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();

  // parallax leve com o mouse
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e) => {
    mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener('pointermove', onMove);

  const still = reducedMotion();
  const clock = new THREE.Clock();
  let raf = 0;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (!still) {
      world.rotation.y = t * 0.035;
      for (const r of riders) {
        r.d += r.speed * dt;
        if (r.d >= r.total) { r.outbound = !r.outbound; newRoute(r); }
        place(r);
        r.line.material.opacity = 0.35 + 0.4 * Math.min(1, r.d / 3);
      }
      const p = (t % 2) / 2;
      ring.scale.setScalar(1 + p * 1.8);
      ring.material.opacity = 0.7 * (1 - p);
      pin.position.y = 1.4 + Math.sin(t * 2.4) * 0.12;
    } else {
      riders.forEach(place);
    }
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    camera.position.set(19 + mouse.x * 1.6, 19 - mouse.y * 1.2, 19);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    if (!still) raf = requestAnimationFrame(frame);
  }
  frame();

  cleanup = () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener('pointermove', onMove);
    scene.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((mt) => mt.dispose());
    });
    glow.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
});

onBeforeUnmount(() => cleanup());
</script>

<style scoped>
.city-scene { position: absolute; inset: 0; overflow: hidden; }
.city-scene :deep(canvas) { display: block; width: 100%; height: 100%; }
</style>
