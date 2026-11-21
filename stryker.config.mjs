// Teste de mutação (StrykerJS): altera o código de propósito ("mutantes") e confere se algum
// teste falha. Mutante que sobrevive = comportamento que nenhum teste verifica.
// Rodar: npm run test:mutation (completo) ou npm run test:mutation:incremental.
// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  // related: false — roda todos os testes na primeira passada (são rápidos); depois o perTest
  // escolhe só os testes que passam por cada mutante. Evita falhas de caminho no Windows.
  vitest: { configFile: 'vitest.config.ts', related: false },
  // Núcleo puro + módulos puros das features: cifras e transposição, senha, validações de
  // cadastro, formatos e tamanhos de áudio, cálculo de tons, datas, erros.
  mutate: [
    'src/lib/**/*.ts',
    '!src/lib/**/*.test.ts',
    'src/features/escalas/schedule-utils.ts',
    'src/features/escalas/share-text.ts',
    'src/features/escalas/setlist.ts',
    'src/features/escalas/pending.ts',
    'src/features/integrantes/sections.ts',
    'src/features/repertorio/editor-checks.ts',
    'src/features/repertorio/history-format.ts',
    'src/features/repertorio/song-key.ts',
    'src/features/repertorio/song-list.ts',
    'src/features/auth/session-cache.ts',
    'src/features/comunicados/audience.ts',
    'supabase/functions/_shared/password.ts',
    'supabase/functions/_shared/invite.ts',
    'supabase/functions/_shared/reset.ts',
  ],
  coverageAnalysis: 'perTest',
  thresholds: { high: 85, low: 70, break: 65 },
  reporters: ['html', 'json', 'clear-text', 'progress'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  // Incremental: reaproveita o resultado anterior e só testa de novo o que mudou.
  incrementalFile: 'reports/stryker-incremental.json',
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always',
  concurrency: 4,
  timeoutMS: 10000,
};
