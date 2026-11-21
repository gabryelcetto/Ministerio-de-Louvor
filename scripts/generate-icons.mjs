// Gera os ícones do app (chama do Louvor ADVOP) em public/ a partir do SVG aprovado.
// Uso (só quando o ícone mudar; os PNGs ficam no Git):
//   npm i --no-save sharp && node scripts/generate-icons.mjs
//
// - favicon.svg: chama sobre fundo #121214 com cantos arredondados;
// - pwa-192 / pwa-512 ("any"): cantos arredondados, fundo transparente fora deles;
// - maskable-512: fundo de borda a borda e a chama dentro da área segura (círculo de 80%);
// - apple-touch-icon (180): borda a borda (o iOS arredonda sozinho).
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const BG = '#121214';
/** Desenho aprovado (viewBox 0 0 24 24). */
export const FLAME_PATHS =
  '<path d="M12 1.8c1.2 3.7 5.3 5.8 5.3 10.6a5.3 5.3 0 0 1-10.6.1c0-2.5 1.4-3.9 2.6-5.1.2 1.9 1 3 2.2 3.6C11 7.9 11.3 4.6 12 1.8z" fill="#F59E0B"/>' +
  '<path d="M12 10.6c.5 1.7 2.4 2.6 2.4 4.8a2.4 2.4 0 0 1-4.8 0c0-1.3.7-2.1 1.4-2.8.1 1 .5 1.4 1.1 1.7-.2-1.4-.3-2.5-.1-3.7z" fill="#FFF3E0"/>';

// A chama vai de y≈1.8 a y≈17.7: centro vertical em ~9.75. Centraliza no quadro de 24.
const FLAME_CENTER_Y = 9.75;

/** SVG do ícone: fundo (arredondado ou de borda a borda) + chama na escala pedida. */
function iconSvg({ scale, radius }) {
  const bg =
    radius === null
      ? `<rect width="24" height="24" fill="${BG}"/>`
      : `<rect width="24" height="24" rx="${radius}" fill="${BG}"/>`;
  const flame = `<g transform="translate(12 12) scale(${scale}) translate(-12 -${FLAME_CENTER_Y})">${FLAME_PATHS}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${bg}${flame}</svg>`;
}

async function png(svg, size, file) {
  await sharp(Buffer.from(svg), { density: Math.ceil((size / 24) * 72) })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(`public/${file}`);
  console.log(`✅ public/${file} (${size}×${size})`);
}

const any = iconSvg({ scale: 0.95, radius: 5.3 });
writeFileSync('public/favicon.svg', `${any}\n`);
console.log('✅ public/favicon.svg');
await png(any, 192, 'pwa-192x192.png');
await png(any, 512, 'pwa-512x512.png');
// Área segura do maskable: círculo com 80% do lado. A chama (≈16 de altura em 24) × 0.78 ≈ 52% de altura, bem dentro do círculo.
await png(iconSvg({ scale: 0.78, radius: null }), 512, 'maskable-512x512.png');
await png(iconSvg({ scale: 0.82, radius: null }), 180, 'apple-touch-icon.png');
