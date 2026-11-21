import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Padrão sem DOM (rápido). Testes de tela pedem o DOM no topo do arquivo:
    // // @vitest-environment happy-dom
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    // Testes de tela montam o app inteiro; com cobertura ou mutação a máquina fica mais lenta.
    testTimeout: 20000,
    // Valores fictícios (o envio de áudio lê o endereço público do Supabase); nada sai para a rede.
    env: {
      VITE_SUPABASE_URL: 'https://teste.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_teste',
    },
    // Cobertura (teste estrutural): npm run test:coverage. O CI reprova abaixo dos limites.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        // Só tipos (gerados pelo Supabase ou declarações): não há código para executar.
        'src/types/**',
        'src/**/*.d.ts',
        // Pontos de entrada do navegador (montam o app e o service worker): cobertos pelo E2E.
        'src/main.tsx',
        'src/sw.ts',
      ],
      reporter: ['text-summary', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: {
        // Projeto inteiro
        lines: 70,
        // Núcleo puro (cifras, datas, áudio, erros…)
        'src/lib/**': { branches: 85, lines: 90 },
      },
    },
  },
});
