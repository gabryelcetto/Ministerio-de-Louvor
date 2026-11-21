// Score de mutação (reports/mutation/mutation.json do Stryker) em Markdown, para o resumo do job.
// Uso: node scripts/mutation-summary.mjs >> "$GITHUB_STEP_SUMMARY"
import { existsSync, readFileSync } from 'node:fs';

const FILE = 'reports/mutation/mutation.json';
if (!existsSync(FILE)) {
  console.log('## Mutação\n\nRelatório não gerado.');
  process.exit(0);
}
const report = JSON.parse(readFileSync(FILE, 'utf8'));
const DETECTED = new Set(['Killed', 'Timeout']);
const VALID = new Set(['Killed', 'Timeout', 'Survived', 'NoCoverage']);

function score(mutants) {
  const valid = mutants.filter((m) => VALID.has(m.status));
  const detected = valid.filter((m) => DETECTED.has(m.status));
  return {
    detected: detected.length,
    valid: valid.length,
    pct: valid.length ? (100 * detected.length) / valid.length : 100,
  };
}

const files = Object.entries(report.files).map(([name, f]) => ({
  name,
  ...score(f.mutants),
  survived: f.mutants.filter((m) => m.status === 'Survived').length,
  noCoverage: f.mutants.filter((m) => m.status === 'NoCoverage').length,
}));
const all = score(Object.values(report.files).flatMap((f) => f.mutants));
const { high = 85, low = 70, break: brk = 65 } = report.thresholds ?? {};
const icon = all.pct >= high ? '🟢' : all.pct >= low ? '🟡' : all.pct >= brk ? '🟠' : '🔴';

console.log(
  [
    '## Mutação (StrykerJS)',
    '',
    `${icon} **Score: ${all.pct.toFixed(2)}%** (${all.detected} de ${all.valid} mutantes detectados) — limites: alto ${high}, baixo ${low}, quebra ${brk}.`,
    '',
    '| Arquivo | Score | Sobreviventes | Sem cobertura |',
    '| --- | --- | --- | --- |',
    ...files
      .sort((a, b) => a.pct - b.pct)
      .map((f) => `| ${f.name} | ${f.pct.toFixed(1)}% | ${f.survived} | ${f.noCoverage} |`),
    '',
    'Relatório HTML completo: artefato **mutacao** desta execução.',
  ].join('\n'),
);
