// Verifica a regra do CLAUDE.md: toda tabela criada numa migration nova tem GRANT explícito
// para `authenticated` (ou um comentário `-- sem-grant: public.tabela — motivo`).
// Os privilégios padrão (20261120200000_explicit_grants.sql) concedem mesmo sem GRANT, então
// um esquecimento passaria nos testes; esta verificação torna a regra obrigatória.
// Uso: node scripts/check-grants.mjs   (sai com código 1 se faltar GRANT)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'supabase/migrations';
// Migrations até esta (inclusive) já estão cobertas pelo GRANT em massa dela.
const BASELINE = '20261120200000';

const CREATE_RE = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi;

function stripComments(sql) {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

export function missingGrants(sql) {
  const code = stripComments(sql);
  const missing = [];
  for (const match of code.matchAll(CREATE_RE)) {
    const table = match[1].toLowerCase();
    const grant = new RegExp(
      `grant\\s+[\\w\\s,()]+?\\s+on\\s+(?:table\\s+)?(?:public\\.)?"?${table}"?\\s+to\\s+[\\w\\s,]*\\bauthenticated\\b`,
      'i',
    );
    const optOut = new RegExp(`--\\s*sem-grant:\\s*(?:public\\.)?${table}\\b`, 'i');
    if (!grant.test(code) && !optOut.test(sql)) missing.push(table);
  }
  return missing;
}

const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql') && f.slice(0, 14) > BASELINE)
  .sort();

let failures = 0;
for (const file of files) {
  for (const table of missingGrants(readFileSync(join(DIR, file), 'utf8'))) {
    console.error(`❌ ${file}: tabela public.${table} sem GRANT explícito para authenticated`);
    failures++;
  }
}
if (failures) {
  console.error(
    '\nAdicione, na mesma migration: grant select, insert, update, delete on public.<tabela> to authenticated;' +
      '\n(ou só os privilégios necessários, ou "-- sem-grant: public.<tabela> — motivo").',
  );
  process.exit(1);
}
console.log(
  `✅ GRANT explícito em todas as tabelas novas (${files.length} migration(s) após ${BASELINE}).`,
);
