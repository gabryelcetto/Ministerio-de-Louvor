// Lê da entrada padrão a lista de arquivos alterados no PR (um por linha) e imprime, separados
// por vírgula, só os que estão na lista `mutate` do stryker.config.mjs (testes ficam de fora).
// Uso: git diff --name-only origin/main...HEAD | node scripts/mutation-files.mjs
import { matchesGlob } from 'node:path';
import config from '../stryker.config.mjs';

const patterns = config.mutate;
const include = patterns.filter((p) => !p.startsWith('!'));
const exclude = patterns.filter((p) => p.startsWith('!')).map((p) => p.slice(1));

const input = await new Promise((resolve) => {
  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (data += chunk));
  process.stdin.on('end', () => resolve(data));
});

const files = input
  .split(/\r?\n/)
  .map((f) => f.trim())
  .filter(Boolean)
  .filter((f) => !/\.test\.[cm]?[jt]sx?$/.test(f))
  .filter((f) => include.some((p) => matchesGlob(f, p)))
  .filter((f) => !exclude.some((p) => matchesGlob(f, p)));

process.stdout.write(files.join(','));
