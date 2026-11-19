// Gera os ícones do PWA (PNG) e o favicon (SVG) sem dependências externas.
// Uso: node scripts/generate-icons.mjs  → grava em public/
//
// Desenho original: colcheia (nota musical) em azul-marinho, com a bandeirola em dourado, sobre
// fundo creme. Coordenadas num quadro de 100×100; o mesmo desenho vira PNG e SVG.
// - pwa-192/512 ("any"): cantos arredondados, fundo transparente fora deles;
// - maskable-512: fundo de borda a borda e desenho reduzido para a zona segura (80%);
// - apple-touch-icon (180): borda a borda (o iOS arredonda sozinho).
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const NAVY = [0x1b, 0x2a, 0x4a];
const GOLD = [0xd4, 0xa8, 0x3a];
const CREAM = [0xfb, 0xf7, 0xee];

// ---- Desenho (quadro 100×100) ------------------------------------------------------------
const HEAD = { cx: 40, cy: 70, rx: 13.5, ry: 9.5, angle: (-24 * Math.PI) / 180 };
const STEM = { x0: 49.2, x1: 55.2, y0: 18, y1: 68 };
/** Bandeirola: curva cúbica que sai do topo da haste, com espessura afinando. */
const FLAG = {
  // Começa atrás da haste (o arredondado do início fica escondido por ela).
  p0: [52.8, 22.5],
  c1: [56, 36],
  c2: [78, 38],
  p3: [70, 60],
  r0: 3.4, // meia-espessura no início
  r1: 1.6, // meia-espessura na ponta
};

function cubic(t, a, b, c, d) {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}
const FLAG_POINTS = Array.from({ length: 48 }, (_, i) => {
  const t = i / 47;
  return {
    x: cubic(t, FLAG.p0[0], FLAG.c1[0], FLAG.c2[0], FLAG.p3[0]),
    y: cubic(t, FLAG.p0[1], FLAG.c1[1], FLAG.c2[1], FLAG.p3[1]),
    r: FLAG.r0 + (FLAG.r1 - FLAG.r0) * t,
  };
});

function inHead(x, y) {
  const dx = x - HEAD.cx;
  const dy = y - HEAD.cy;
  const cos = Math.cos(-HEAD.angle);
  const sin = Math.sin(-HEAD.angle);
  const u = dx * cos - dy * sin;
  const v = dx * sin + dy * cos;
  return (u / HEAD.rx) ** 2 + (v / HEAD.ry) ** 2 <= 1;
}
const inStem = (x, y) => x >= STEM.x0 && x <= STEM.x1 && y >= STEM.y0 && y <= STEM.y1;
function inFlag(x, y) {
  for (let i = 0; i < FLAG_POINTS.length - 1; i++) {
    const a = FLAG_POINTS[i];
    const b = FLAG_POINTS[i + 1];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy)));
    const r = a.r + (b.r - a.r) * t;
    if (Math.hypot(x - (a.x + vx * t), y - (a.y + vy * t)) <= r) return true;
  }
  return false;
}

/** Cor do desenho num ponto do quadro 100×100 (null = fundo). */
function art(x, y) {
  if (inHead(x, y) || inStem(x, y)) return NAVY;
  if (inFlag(x, y)) return GOLD;
  return null;
}

/** Canto arredondado do ícone "any" (raio 22 no quadro 100×100). */
function inRoundedSquare(x, y, radius = 22) {
  const cx = Math.min(Math.max(x, radius), 100 - radius);
  const cy = Math.min(Math.max(y, radius), 100 - radius);
  return Math.hypot(x - cx, y - cy) <= radius;
}

// ---- PNG ---------------------------------------------------------------------------------
function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (const byte of buf) {
    c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/**
 * @param {number} size lado em pixels
 * @param {{ scale?: number, rounded?: boolean }} options scale < 1 encolhe o desenho (maskable)
 */
function png(size, { scale = 1, rounded = false } = {}) {
  const SS = 4; // supersampling 4×4 por pixel (antialiasing)
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py++) {
    const row = py * (size * 4 + 1);
    raw[row] = 0; // filtro: none
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = ((px + (sx + 0.5) / SS) / size) * 100;
          const fy = ((py + (sy + 0.5) / SS) / size) * 100;
          if (rounded && !inRoundedSquare(fx, fy)) continue;
          // Desenho centralizado e reduzido em volta do centro (50, 50).
          const color = art(50 + (fx - 50) / scale, 50 + (fy - 50) / scale) ?? CREAM;
          r += color[0];
          g += color[1];
          b += color[2];
          a += 1;
        }
      }
      const o = row + 1 + px * 4;
      if (a > 0) {
        raw[o] = Math.round(r / a);
        raw[o + 1] = Math.round(g / a);
        raw[o + 2] = Math.round(b / a);
      }
      raw[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- SVG (favicon), mesmo desenho --------------------------------------------------------
const hex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const flagPath = (() => {
  // Contorno da bandeirola: lado esquerdo indo, lado direito voltando (espessura variável).
  const left = [];
  const right = [];
  for (let i = 0; i < FLAG_POINTS.length; i++) {
    const p = FLAG_POINTS[i];
    const q = FLAG_POINTS[Math.min(i + 1, FLAG_POINTS.length - 1)];
    const o = FLAG_POINTS[Math.max(i - 1, 0)];
    const tx = q.x - o.x;
    const ty = q.y - o.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;
    left.push(`${(p.x + nx * p.r).toFixed(2)} ${(p.y + ny * p.r).toFixed(2)}`);
    right.push(`${(p.x - nx * p.r).toFixed(2)} ${(p.y - ny * p.r).toFixed(2)}`);
  }
  const end = FLAG_POINTS[FLAG_POINTS.length - 1];
  return `M${left.join(' L')} A${end.r} ${end.r} 0 0 1 ${right.reverse().join(' L')} Z`;
})();
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="${hex(CREAM)}"/>
  <path d="${flagPath}" fill="${hex(GOLD)}"/>
  <rect x="${STEM.x0}" y="${STEM.y0}" width="${(STEM.x1 - STEM.x0).toFixed(1)}" height="${STEM.y1 - STEM.y0}" fill="${hex(NAVY)}"/>
  <ellipse cx="${HEAD.cx}" cy="${HEAD.cy}" rx="${HEAD.rx}" ry="${HEAD.ry}" transform="rotate(-24 ${HEAD.cx} ${HEAD.cy})" fill="${hex(NAVY)}"/>
</svg>
`;

writeFileSync('public/pwa-192x192.png', png(192, { rounded: true }));
writeFileSync('public/pwa-512x512.png', png(512, { rounded: true }));
writeFileSync('public/maskable-512x512.png', png(512, { scale: 0.78 }));
writeFileSync('public/apple-touch-icon.png', png(180, { scale: 0.92 }));
writeFileSync('public/favicon.svg', svg);
console.log('Ícones gerados em public/');
