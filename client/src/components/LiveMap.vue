<template>
  <div ref="el" class="live-map"></div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { animate } from 'animejs';
import { STATUS, effStatus, initials } from '../lib/api.js';
import { reducedMotion } from '../lib/motion.js';

const props = defineProps({
  drivers: { type: Array, default: () => [] },
  restaurant: { type: Object, default: null },
  selectedId: { type: String, default: null },
  follow: { type: Boolean, default: false },
});
const emit = defineEmits(['select', 'stop-follow']);

const el = ref(null);
let map, storeMarker;
const items = new Map(); // id -> { marker, trail, pos, anim, status }
let fitted = false;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function pinHtml(d) {
  const st = effStatus(d);
  const moving = d.online && d.speed > 0.5;
  return `<div class="pin ${st === 'offline' ? 'off' : ''} ${props.selectedId === d.id ? 'sel' : ''}" style="--c:${STATUS[st].color}">
    ${moving ? `<i class="arrow" style="transform:translateX(-50%) rotate(${d.heading}deg)"></i>` : ''}
    ${st === 'entrega' ? '<i class="ping"></i>' : ''}
    <span>${esc(initials(d.name))}</span></div>`;
}
const icon = (d) => L.divIcon({ className: 'pin-wrap', iconSize: [36, 36], iconAnchor: [18, 18], html: pinHtml(d) });

function sync() {
  if (!map) return;
  const r = props.restaurant;
  if (r && !storeMarker) {
    storeMarker = L.marker([r.lat, r.lng], {
      zIndexOffset: 1000,
      icon: L.divIcon({
        className: 'pin-wrap', iconSize: [42, 42], iconAnchor: [21, 21],
        html: '<div class="store"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10h18l-1.5-5h-15z"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/></svg></div>',
      }),
    }).addTo(map).bindTooltip(esc(r.name), { direction: 'top', offset: [0, -18] });
  }

  const seen = new Set();
  for (const d of props.drivers) {
    if (d.lat == null) continue;
    seen.add(d.id);
    const st = effStatus(d);
    const color = STATUS[st].color;
    let it = items.get(d.id);
    if (!it) {
      const marker = L.marker([d.lat, d.lng], { icon: icon(d) }).addTo(map).on('click', () => emit('select', d.id));
      const trail = L.polyline(d.trail || [], { color, weight: 4, opacity: 0.7, lineCap: 'round' }).addTo(map);
      it = { marker, trail, pos: { lat: d.lat, lng: d.lng }, anim: null, status: st };
      items.set(d.id, it);
      const node = marker.getElement()?.firstElementChild;
      if (node && !reducedMotion()) animate(node, { scale: [0, 1], duration: 700, ease: 'outElastic(1, .6)' });
    } else {
      // movimento suave entre atualizações de GPS
      it.anim?.pause();
      if (reducedMotion()) { it.pos.lat = d.lat; it.pos.lng = d.lng; it.marker.setLatLng([d.lat, d.lng]); }
      else {
        it.anim = animate(it.pos, {
          lat: d.lat, lng: d.lng, duration: 1800, ease: 'linear',
          onUpdate: () => it.marker.setLatLng([it.pos.lat, it.pos.lng]),
        });
      }
      it.marker.setIcon(icon(d));
      if (it.status !== st) {
        const node = it.marker.getElement()?.firstElementChild;
        if (node && !reducedMotion()) animate(node, { scale: [1.5, 1], duration: 600, ease: 'outElastic(1, .5)' });
        it.status = st;
      }
      it.trail.setLatLngs(d.trail || []);
      it.trail.setStyle({ color });
    }
    it.marker.bindTooltip(`<b>${esc(d.name)}</b><br>${STATUS[st].label}${d.order ? ' · ' + esc(d.order) : ''}`, { direction: 'top', offset: [0, -18] });
    it.marker.setZIndexOffset(props.selectedId === d.id ? 900 : 0);
  }
  for (const [id, it] of items) {
    if (seen.has(id)) continue;
    it.anim?.pause();
    map.removeLayer(it.marker);
    map.removeLayer(it.trail);
    items.delete(id);
  }

  if (!fitted && seen.size) {
    fitted = true;
    const pts = props.drivers.filter((d) => d.lat != null).map((d) => [d.lat, d.lng]);
    if (r) pts.push([r.lat, r.lng]);
    map.fitBounds(pts, { padding: [60, 60], maxZoom: 15 });
  }
  if (props.follow && props.selectedId) {
    const d = props.drivers.find((x) => x.id === props.selectedId);
    if (d?.lat != null) map.panTo([d.lat, d.lng], { animate: true, duration: 1.5 });
  }
}

onMounted(() => {
  map = L.map(el.value, { zoomControl: true, attributionControl: true }).setView([-23.5614, -46.6826], 14);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(map);
  map.on('dragstart', () => emit('stop-follow'));
  sync();
});
onBeforeUnmount(() => { items.forEach((it) => it.anim?.pause()); map?.remove(); });

watch(() => [props.drivers, props.restaurant], sync);
watch(() => props.selectedId, (id) => {
  sync();
  const d = props.drivers.find((x) => x.id === id);
  if (d?.lat != null) map.flyTo([d.lat, d.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
});
</script>

<style scoped>
.live-map { height: 100%; width: 100%; background: #e9e9ec; }
.live-map :deep(.leaflet-tile-pane) { filter: saturate(.55) contrast(1.02); }
.live-map :deep(.pin-wrap) { background: none; border: 0; }
.live-map :deep(.pin) {
  width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; position: relative;
  background: var(--c); color: #fff; font: 800 12px var(--font); border: 3px solid #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,.18), 0 10px 24px rgba(20,20,30,.22); transition: box-shadow .2s;
}
.live-map :deep(.pin span) { position: relative; z-index: 1; }
.live-map :deep(.pin.sel) { box-shadow: 0 0 0 4px #15151555, 0 10px 24px rgba(20,20,30,.3); }
.live-map :deep(.pin.off) { opacity: .5; filter: grayscale(1); }
.live-map :deep(.pin .arrow) { position: absolute; top: -10px; left: 50%; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-bottom: 8px solid #151515; transform-origin: 50% 28px; }
.live-map :deep(.pin .ping) { position: absolute; inset: -3px; border-radius: 50%; border: 2px solid var(--c); animation: ping 1.8s ease-out infinite; }
@keyframes ping { from { transform: scale(1); opacity: .8; } to { transform: scale(2); opacity: 0; } }
.live-map :deep(.store) { width: 42px; height: 42px; border-radius: 12px; background: #151515; display: grid; place-items: center; border: 3px solid #fff; box-shadow: 0 10px 24px rgba(20,20,30,.3); }
.live-map :deep(.store svg) { width: 20px; height: 20px; }
.live-map :deep(.leaflet-tooltip) { font-family: var(--font); font-size: 12px; border-radius: 10px; border: 0; color: #3e3e3e; box-shadow: 0 2px 6px rgba(0,0,0,.06), 0 16px 40px rgba(20,20,30,.16); }
.live-map :deep(.leaflet-tooltip b) { color: #151515; }
</style>
