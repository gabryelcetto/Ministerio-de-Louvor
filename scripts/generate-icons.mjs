// Gera os ícones PLACEHOLDER do PWA (PNG) sem dependências externas.
// Uso: node scripts/generate-icons.mjs  → grava em public/
// Desenho: fundo azul-marinho com um círculo dourado. Troque pelos ícones finais quando houver logo.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const NAVY = [0x1b, 0x2a, 0x4a];
const GOLD = [0xd4, 0xa8, 0x3a];
const WHITE = [0xff, 0xff, 0xff];

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

/** @param {number} size @param {number} safeZone fração do raio útil (maskable usa 0.8) */
function png(size, safeZone) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const c = size / 2;
  const outer = (size / 2) * safeZone * 0.62;
  const inner = outer * 0.55;
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0; // filtro: none
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      const color = d < inner ? WHITE : d < outer ? GOLD : NAVY;
      raw.set(color, row + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync('public/pwa-192x192.png', png(192, 1));
writeFileSync('public/pwa-512x512.png', png(512, 1));
writeFileSync('public/maskable-512x512.png', png(512, 0.8));
writeFileSync('public/apple-touch-icon.png', png(180, 1));
writeFileSync(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1b2a4a"/><circle cx="32" cy="32" r="20" fill="#d4a83a"/><circle cx="32" cy="32" r="11" fill="#fff"/></svg>\n`,
);
console.log('Ícones gerados em public/');
