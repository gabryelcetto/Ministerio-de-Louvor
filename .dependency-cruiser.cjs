/**
 * Testes de arquitetura (dependency-cruiser). Rodar: npm run test:arch
 * O CI reprova se alguma regra "error" quebrar.
 *
 * Camadas:
 * - src/lib: TypeScript puro (cifras, datas, áudio, erros…). Sem React, sem Supabase e sem
 *   depender de features, app ou componentes: é o que mais se testa (cobertura e mutação).
 * - src/features/<x>: cada feature só usa outra pela API pública dela (src/features/<y>/index.ts).
 * - src/app: monta as rotas e pode importar as telas das features.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'sem-dependencia-circular',
      comment: 'Dependência circular: um módulo acaba importando a si mesmo por outro caminho.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'lib-sem-react',
      comment:
        'src/lib é TypeScript puro: hooks e componentes React ficam em src/hooks ou nas features.',
      severity: 'error',
      from: { path: '^src/lib/' },
      to: { path: '(^|/)node_modules/(react|react-dom|react-router|@tanstack/react-query)(/|$)' },
    },
    {
      name: 'lib-sem-supabase',
      comment: 'src/lib não conversa com o banco: o cliente fica em src/services/supabase.ts.',
      severity: 'error',
      from: { path: '^src/lib/' },
      to: { path: ['(^|/)node_modules/@supabase/', '^src/services/'] },
    },
    {
      name: 'lib-independente',
      comment: 'src/lib não depende das camadas de cima (features, app, componentes, hooks).',
      severity: 'error',
      from: { path: '^src/lib/' },
      to: { path: '^src/(features|app|components|hooks|services)/' },
    },
    {
      name: 'feature-so-pela-api-publica',
      comment:
        'Uma feature não importa arquivos internos de outra: use @/features/<outra> (index.ts).',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: {
        path: '^src/features/[^/]+/',
        pathNot: ['^src/features/$1/', '^src/features/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'sem-orfaos',
      comment: 'Arquivo que ninguém importa (código morto).',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '\\.d\\.ts$',
          '\\.test\\.tsx?$',
          '^src/test/',
          '^src/main\\.tsx$',
          '^src/sw\\.ts$',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Testes podem montar cenários com arquivos internos; as regras valem para o código do app.
    exclude: { path: ['\\.test\\.tsx?$', '^src/test/'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
