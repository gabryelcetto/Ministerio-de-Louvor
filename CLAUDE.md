# CLAUDE.md — Ministério de Louvor

Instruções para o agente que trabalha neste repositório. Antes de qualquer ação, leia também
`docs/pendencias.md` e `docs/diario-de-bordo.md`.

> Este arquivo não existia no repositório até a fase E (as regras eram passadas por mensagem).
> A seção "Fluxo de trabalho" abaixo traz as regras **em vigor desde 19/11/2026**, que valem mais
> que qualquer versão anterior destas instruções.

## Fluxo de trabalho (atualizado em 19/11/2026)

1. **Branches:** a `main` já existe no GitHub. **Não empilhe branches.** Cada entrega sai da
   `main` atualizada (`git fetch origin main` + branch nova a partir de `origin/main`) e abre PR
   **direto para a `main`**.
2. **Nunca faça push na `main`.** Ela só muda por merge de PR.
3. **Coautoria obrigatória em todo commit**, inclusive commits de merge (linha `Co-Authored-By`
   no fim da mensagem).
4. **Sem limite de horário:** a antiga regra 5.1 (parar às 05:00) foi **revogada**. A execução
   segue até a entrega estar completa e validada.

## Validação antes de abrir PR

```bash
npm run lint
npm run typecheck
npm test
VITE_SUPABASE_URL=https://exemplo.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ci_placeholder npm run build
npm run format:check
```

- Os testes pgTAP (`supabase test db`) rodam no job `db` do CI. Sem Docker/banco local, não rode
  `supabase start` nem `supabase test db`; registre em `docs/pendencias.md` o que ficou sem teste
  com dados reais.

## Convenções do código

- Textos da interface e documentação em **português**.
- Toda autorização mora no Postgres (RLS + `has_permission`). `usePermission()` é só para a
  interface.
- Em `profiles`, sempre liste as colunas no `select` (a coluna `phone` não é legível pela API).
- `src/types/database.types.ts` é **gerado** (`npx supabase gen types typescript --local`; não
  edite à mão). O artefato `e2e-output` do workflow E2E traz o arquivo gerado de cada PR.
  Tipos de domínio, o estreitamento das colunas com CHECK e o formato do `get_dashboard` ficam
  em `src/types/app.types.ts`; o cliente usa `AppDatabase`. Importe tipos de
  `@/types/app.types`. Strings de `select` devem ser um literal único (sem `${}` ou `+`), senão o
  supabase-js não infere o resultado.
- Toda migration nova pede: tipos regenerados, teste pgTAP e o workflow **E2E (dados reais)**
  verde (`e2e/`).
- Erros para o usuário só via `friendlyError()` (`src/lib/errors.ts`); escritas pedem `.select()` e
  passam por `requireAffected()` (o RLS barra UPDATE/DELETE sem erro, com 0 linhas).
- Botões dentro de `<form>` sempre com `type` explícito (`button` ou `submit`).
- Cores só por tokens do tema (`src/index.css`); nada de cor fixa nos componentes.
- Datas sempre no fuso `America/Sao_Paulo` (`src/lib/dates.ts`), o mesmo dos triggers do banco.
- Registre cada fase em `docs/diario-de-bordo.md` e o que ficou em aberto em `docs/pendencias.md`.
