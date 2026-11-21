import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { brand, brandTitle } from './src/config/brand';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Título da aba vem de src/config/brand.ts (index.html usa %BRAND_TITLE%).
    {
      name: 'brand-title',
      transformIndexHtml: (html) => html.replaceAll('%BRAND_TITLE%', brandTitle),
    },
    react(),
    tailwindcss(),
    VitePWA({
      // Service worker próprio (src/sw.ts): controle total sobre cache e, no futuro, Web Push.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: brand.shortName,
        short_name: brand.shortName,
        description: brand.description,
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fbf7ee', // creme do ícone (tela de abertura do app instalado)
        theme_color: '#1b2a4a',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
