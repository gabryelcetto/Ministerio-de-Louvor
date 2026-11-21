/**
 * Playwright Test só para as capturas do design (tests/e2e/capturas.spec.ts).
 * Roda no workflow "E2E (dados reais)", com o app apontando para o Supabase local e os dados
 * do seed. Nada daqui roda nesta máquina (sem Playwright local).
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /capturas\.spec\.ts$/,
  outputDir: '../../capturas-design/resultados',
  reporter: [['list']],
  workers: 1,
  timeout: 120_000,
  use: {
    baseURL: process.env.BASE ?? 'http://127.0.0.1:5173',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    serviceWorkers: 'block',
  },
});
