// Resumo da cobertura (coverage/coverage-summary.json) em Markdown, para o resumo do job no CI.
// Uso: node scripts/coverage-summary.mjs >> "$GITHUB_STEP_SUMMARY"
import { existsSync, readFileSync } from 'node:fs';

const FILE = 'coverage/coverage-summary.json';
if (!existsSync(FILE)) {
  console.log('## Cobertura\n\nRelatório não gerado (os testes falharam antes).');
  process.exit(0);
}
const summary = JSON.parse(readFileSync(FILE, 'utf8'));
const KEYS = ['statements', 'branches', 'functions', 'lines'];

/** Soma os arquivos de um diretório (ex.: src/lib) a partir do resumo por arquivo. */
function aggregate(prefix) {
  const totals = Object.fromEntries(KEYS.map((k) => [k, { covered: 0, total: 0 }]));
  for (const [file, data] of Object.entries(summary)) {
    if (file === 'total') continue;
    if (!file.replaceAll('\\', '/').includes(`/${prefix}/`)) continue;
    for (const k of KEYS) {
      totals[k].covered += data[k].covered;
      totals[k].total += data[k].total;
    }
  }
  return Object.fromEntries(
    KEYS.map((k) => [k, totals[k].total ? (100 * totals[k].covered) / totals[k].total : 100]),
  );
}

const pct = (v) => `${v.toFixed(1)}%`;
const total = Object.fromEntries(KEYS.map((k) => [k, summary.total[k].pct]));
const lib = aggregate('src/lib');
console.log(
  [
    '## Cobertura (Vitest, v8)',
    '',
    '| Escopo | Statements | Branches | Functions | Lines | Limite |',
    '| --- | --- | --- | --- | --- | --- |',
    `| Projeto | ${KEYS.map((k) => pct(total[k])).join(' | ')} | linhas ≥ 70% |`,
    `| src/lib | ${KEYS.map((k) => pct(lib[k])).join(' | ')} | linhas ≥ 90%, branches ≥ 85% |`,
    '',
    'Relatório HTML completo: artefato **cobertura** desta execução.',
  ].join('\n'),
);
