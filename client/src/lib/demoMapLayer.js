// Mapa ilustrativo para o modo demonstração: desenha uma cidade em grade
// direto no canvas (o artefato não pode carregar imagens de servidores de mapa).
import L from 'leaflet';

const U = 34;          // quarteirão + rua, em pixels no zoom 15
const AVENUE_EVERY = 6;

function hash(i, j) {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// início e fim de um quarteirão no eixo (zoom 15), com avenidas mais largas
function span(i) {
  const gap = ((i % AVENUE_EVERY) + AVENUE_EVERY) % AVENUE_EVERY === 0 ? 11 : 5;
  return [i * U + gap, (i + 1) * U];
}

export function demoCityLayer() {
  const Layer = L.GridLayer.extend({
    createTile(coords) {
      const tile = document.createElement('canvas');
      const size = this.getTileSize();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      tile.width = size.x * dpr;
      tile.height = size.y * dpr;
      const g = tile.getContext('2d');
      g.scale(dpr, dpr);

      // asfalto
      g.fillStyle = '#f6f6f8';
      g.fillRect(0, 0, size.x, size.y);

      const s = 2 ** (coords.z - 15);           // pixels deste zoom por pixel do zoom 15
      const x0 = coords.x * size.x, y0 = coords.y * size.y;
      const i0 = Math.floor(x0 / s / U) - 1, i1 = Math.ceil((x0 + size.x) / s / U) + 1;
      const j0 = Math.floor(y0 / s / U) - 1, j1 = Math.ceil((y0 + size.y) / s / U) + 1;
      if (i1 - i0 > 400) return tile; // zoom muito afastado: só o fundo

      for (let i = i0; i <= i1; i++) {
        const [ax, bx] = span(i);
        for (let j = j0; j <= j1; j++) {
          const [ay, by] = span(j);
          const r = hash(i, j);
          const x = ax * s - x0, y = ay * s - y0, w = (bx - ax) * s, h = (by - ay) * s;
          if (r < 0.06) g.fillStyle = '#d5ebdb';        // praça
          else if (r < 0.075) g.fillStyle = '#dce8f3';  // escola / hospital
          else g.fillStyle = `hsl(240, 6%, ${86 + r * 6}%)`;
          const rad = Math.min(3 * s, w / 4);
          g.beginPath();
          g.roundRect ? g.roundRect(x, y, w, h, rad) : g.rect(x, y, w, h);
          g.fill();
          // lotes dentro do quarteirão quando o zoom é próximo
          if (s >= 2 && r >= 0.075) {
            g.strokeStyle = 'rgba(255,255,255,.55)';
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(x + w / 2, y + 2); g.lineTo(x + w / 2, y + h - 2);
            g.moveTo(x + 2, y + h / 2); g.lineTo(x + w - 2, y + h / 2);
            g.stroke();
          }
        }
      }

      // avenidas com faixa central
      if (s >= 0.5) {
        g.strokeStyle = '#f1c96b';
        g.lineWidth = Math.max(1, 1.2 * s);
        g.setLineDash([6 * s, 6 * s]);
        for (let i = i0; i <= i1; i++) {
          if (((i % AVENUE_EVERY) + AVENUE_EVERY) % AVENUE_EVERY !== 0) continue;
          const c = (i * U + 5.5) * s;
          g.beginPath(); g.moveTo(c - x0, 0); g.lineTo(c - x0, size.y); g.stroke();
          g.beginPath(); g.moveTo(0, c - y0); g.lineTo(size.x, c - y0); g.stroke();
        }
        g.setLineDash([]);
      }
      return tile;
    },
  });
  return new Layer({ attribution: 'Mapa ilustrativo · demonstração', minZoom: 12, maxZoom: 18 });
}
