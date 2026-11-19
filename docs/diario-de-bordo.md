# Diário de bordo

Registro do que foi feito em cada fase, onde fica cada arquivo e por que as decisões foram tomadas.

---

## Fase A — Fundação (19/11/2026)

### Arquivos criados

**Configuração do projeto (raiz)**

- `package.json` — dependências e scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `format`. O
  `package-lock.json` trava as versões exatas para o `npm ci` do CI instalar sempre o mesmo.
- `tsconfig.json` — "solução" que só referencia os dois projetos abaixo (padrão do Vite).
- `tsconfig.app.json` — regras do TypeScript para o código do navegador (`src/`): `strict`,
  `noUncheckedIndexedAccess` (acesso a array pode ser `undefined`) e alias `@/` → `src/`.
- `tsconfig.node.json` — regras para os arquivos de configuração que rodam no Node (`vite.config.ts`…).
- `vite.config.ts` — plugins: React, Tailwind e PWA. Define o alias `@/` e o manifest do PWA.
- `vitest.config.ts` — testes unitários com Vitest (procura `src/**/*.test.ts(x)`).
- `eslint.config.js` — ESLint "flat config": regras recomendadas de JS/TS, regras de hooks do React e
  `eslint-config-prettier` (desliga regras de estilo que brigariam com o Prettier).
- `.prettierrc.json` / `.prettierignore` — formatação automática (aspas simples, 100 colunas).
- `.gitignore` — tira do Git `node_modules`, `dist` e **todo `.env*` local** (o repo é público).
- `.env.example` — modelo das únicas duas variáveis do frontend, ambas públicas.
- `components.json` — configuração do shadcn/ui (permite rodar `npx shadcn add <componente>` depois).
- `wrangler.jsonc` — deploy na Cloudflare Workers servindo `dist/` como arquivos estáticos;
  `not_found_handling: "single-page-application"` faz `/repertorio/123` devolver o `index.html`.
- `index.html` — página única da SPA (idioma `pt-BR`, `theme-color`, ícones).

**Código (`src/`)**

- `src/main.tsx` — ponto de entrada: monta providers e o roteador no `#root`.
- `src/app/providers.tsx` — `QueryClientProvider` do TanStack Query (cache das consultas ao banco).
- `src/app/router.tsx` — rotas (React Router). Por enquanto `/` e a página 404.
- `src/app/home-page.tsx` / `src/app/not-found-page.tsx` — telas provisórias.
- `src/index.css` — Tailwind v4 + **tema provisório em variáveis CSS** (azul-marinho, roxo, branco,
  dourado, com modo escuro). Para trocar a identidade visual, mexa só no bloco `:root`.
- `src/components/ui/button.tsx`, `card.tsx` — componentes no padrão shadcn/ui (o código fica no
  projeto, não numa biblioteca fechada, então dá para editar à vontade).
- `src/lib/utils.ts` — função `cn()` que junta classes Tailwind sem conflito.
- `src/lib/env.ts` (+ `env.test.ts`) — lê e valida `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_PUBLISHABLE_KEY`; se faltar, o erro diz exatamente o que fazer.
- `src/lib/supabase.ts` — **cliente Supabase único** do app (só chave pública).
- `src/vite-env.d.ts` — tipos das variáveis `import.meta.env`.
- `src/sw.ts` — service worker próprio: pré-cache do build e fallback de navegação para o `index.html`.
- `src/features/*`, `src/types/` — pastas dos módulos (preenchidas nas próximas fases).

**Outros**

- `scripts/generate-icons.mjs` — gera os ícones placeholder do PWA (PNG) só com Node, sem dependência.
- `public/` — `pwa-192x192.png`, `pwa-512x512.png`, `maskable-512x512.png`, `apple-touch-icon.png`,
  `favicon.svg` (gerados pelo script acima).
- `.github/workflows/ci.yml` — CI no GitHub Actions: Node LTS, `npm ci`, lint, typecheck, testes, build.
- `docs/pendencias.md` — o que depende do dono ou ficou em aberto.

### Decisões

- **Tailwind v4 com `@tailwindcss/vite`**: não precisa de `tailwind.config.js` nem PostCSS; o tema fica
  no CSS (`@theme inline`) apontando para as variáveis do `:root`. Trocar cor = trocar uma variável.
- **shadcn/ui escrito à mão** (sem rodar o CLI interativo): mesmo código que o CLI geraria; o
  `components.json` deixa o CLI pronto para adicionar mais componentes.
- **PWA com `injectManifest`**: nós escrevemos o service worker (`src/sw.ts`) e o plugin só injeta a
  lista de arquivos. Isso deixa espaço para Web Push no futuro. `registerType: 'prompt'` evita trocar a
  versão do app no meio de um culto sem o usuário pedir. O registro do SW entra na fase D.
- **Validação de env separada do cliente** (`env.ts`): dá para testar sem rede e a mensagem de erro é
  em português, explicando onde pegar os valores.
- **CI com valores fictícios** de env no build: o build não depende de segredo nenhum.
- **`noUncheckedIndexedAccess`**: mais rígido que o `strict`; evita o clássico "undefined is not a
  function" ao acessar `lista[0]`.
- **Commit inicial vazio na `main` local**: a base das branches empilhadas. Ver pendência 1.

---

## Fase B — Banco (19/11/2026)

### Arquivos criados

- `supabase/config.toml` — configuração do Supabase **local** (CLI): portas, seed e Auth com
  **cadastro público desligado** (`enable_signup = false`), usuários só por convite/painel.
- `supabase/migrations/20261119070000_access.sql` — extensões (`unaccent`, `pg_trgm`), enum
  `access_role`, `profiles` (+ trigger que cria o perfil quando nasce um usuário no Auth),
  `permissions`, `role_permissions`, `user_permissions`, `ministry_functions`, `member_functions`,
  `audit_logs`, e as funções `is_active_member()`, `has_permission(p)`, `my_permissions()` e
  `get_member_contacts()`.
- `supabase/migrations/20261119070100_agenda.sql` — `events` e `event_assignments` (a escala).
- `supabase/migrations/20261119070200_repertoire.sql` — `songs`, `song_lyrics`, `song_chords`,
  `song_versions` (histórico), `song_favorites`, `event_songs`, busca sem acento (`search_songs`) e
  os triggers de versão, de tom oficial e de cifra pendente; RPC `restore_song_version`.
- `supabase/migrations/20261119070300_communication.sql` — `announcements`, `notifications`
  (geradas por trigger quando alguém entra/sai da escala ou o evento muda/é cancelado) e a RPC
  `get_dashboard()`.
- `supabase/seed.sql` — permissões e padrões por perfil, funções do ministério, 12 músicas (10 hinos
  em domínio público, só a 1ª estrofe, + 2 textos fictícios que exercitam a notação brasileira de
  acordes), 5 eventos nas próximas 2 semanas, repertório dos cultos e 3 comunicados.
- `supabase/demo-users.sql` — script para rodar no SQL Editor **depois** de criar os 3 usuários no
  painel: define perfis (admin dono, líder, integrante), funções e escalas.
- `supabase/tests/rls.test.sql` — 31 testes pgTAP (admin, líder, integrante, inativo e anônimo).
- `src/types/database.types.ts` — tipos TypeScript do banco (escritos à mão; ver pendências).
- `src/lib/supabase.ts` — agora tipado com `createClient<Database>`.
- `.github/workflows/ci.yml` — novo job `db`: instala o Supabase CLI, `supabase db start`,
  `supabase test db`.

### Decisões

- **Toda a autorização mora no Postgres.** As políticas chamam `has_permission()`, que é
  `security definer` (lê as tabelas de permissão sem esbarrar no próprio RLS) e tem
  `search_path = ''` (evita sequestro de função por outro schema). A regra é: inativo → nada;
  dono → tudo; exceção individual (`grant`/`deny`) decide; senão vale o padrão do perfil.
- **Telefone protegido por GRANT de coluna**, não só por RLS: RLS filtra _linhas_, não _colunas_.
  A coluna `phone` não é legível pela API; quem tem `members.view_contacts` usa
  `get_member_contacts()`. Consequência para o frontend: em `profiles`, liste as colunas no
  `select(...)` (não use `select('*')`).
- **Ninguém se promove**: trigger `guard_profile_update` barra mudar `access_role`/`status` sem
  `members.manage` e bloqueia mexer em `is_owner` pela API.
- **Histórico só por trigger**: `song_versions` não tem policy de insert/update/delete. Os triggers
  (security definer) gravam valor antigo, novo, autor e tipo (`create`/`update`/`restore`).
- **Restaurar = nova alteração**: `restore_song_version` aplica o valor daquela versão e o trigger
  registra uma versão `restore`; nada do histórico é apagado. Também grava em `audit_logs`.
- **Cifra de quem não tem permissão nasce `pending`** (trigger `BEFORE INSERT`), mesmo que o
  cliente mande `official`. UPDATE de cifra só com `chords.edit_official` (policy).
- **`auth.uid()` nulo = contexto administrativo** (seed, migrations, SQL Editor). Os triggers de
  guarda liberam esse caso; pela API isso nunca acontece, porque anônimo não tem policy nenhuma.
- **Busca sem acento indexada**: `unaccent()` não é `IMMUTABLE`, então criamos o wrapper
  `immutable_unaccent()` para poder usar em índice GIN trigram.
- **Seed em inglês nos hinos**: as traduções em português de hinos antigos podem ter tradutor com
  direitos ainda vigentes; os originais em inglês anteriores a 1929 são domínio público com certeza.
- **Datas do seed relativas a `current_date`**: a agenda sempre parece "viva" na demonstração.

---

## Fase C — Cifras (19/11/2026)

### Arquivos criados

- `src/lib/chords/notes.ts` — notas e tons: nota ↔ número (0–11), transposição de nota, grafia
  padrão dos tons (`A#` → `Bb`), distância entre tons, e `keyPrefersFlats()` (o tom usa bemol?).
- `src/lib/chords/chord.ts` — reconhece um acorde (`parseChord`/`isChord`) separando tônica, sufixo
  e baixo, e transpõe (`transposeChord`). Aceita notação brasileira (`7M`, `7(9)`, `m7(b5)`, `°`) e
  americana (`maj7`, `m7b5`, `dim`, `sus4`, `add9`), e baixo invertido (`D/F#`).
- `src/lib/chords/chordpro.ts` — parser de ChordPro (linhas de letra com `[G]`, diretivas `{key: G}`,
  comentários `{c: Refrão}`), extração de acordes e transposição da cifra inteira por semitons ou
  para um tom alvo, atualizando o `{key}`.
- `src/lib/chords/convert.ts` — conversor de "acordes sobre a letra" (o formato comum em sites e
  cadernos) para ChordPro, usando a coluna de cada acorde. Linhas como `Intro: G D Em C` também.
- `src/lib/chords/layout.ts` — `toSheetUnits()`: quebra cada linha em unidades "acorde + sílaba" e
  palavras soltas, para o navegador quebrar a linha sem separar o acorde da sílaba.
- `src/lib/chords/index.ts` — ponto único de importação (`import { ... } from '@/lib/chords'`).
- `src/lib/chords/chords.test.ts` — 57 testes Vitest com trechos reais dos hinos do seed.
- `src/features/repertorio/components/chord-sheet.tsx` — componente `<ChordSheet>`: recebe a cifra
  ChordPro, os semitons e se mostra acordes; renderiza acorde sobre a sílaba com `flex-wrap`.

### Decisões

- **Biblioteca pura, sem React e sem dependências**: fácil de testar e reaproveitar (ex.: numa
  Edge Function ou num futuro app).
- **O sufixo nunca é reescrito**: só tônica e baixo mudam. Assim `7M` continua `7M` e `m7(b5)`
  continua `m7(b5)` — o músico lê do jeito que está acostumado.
- **Sustenido x bemol pelo tom de destino**: transpor `G` para `F` gera `Bb` (não `A#`); para `A`
  gera `F#m`. Na transposição por semitons, o tom de destino sai do `{key}` da cifra.
- **Reconhecimento de acorde por "tokens" de sufixo** em vez de uma lista fixa de acordes: cobre
  combinações como `G7(#11)`, `C6(9)`, `E7(b9)` sem precisar listar uma a uma, e ainda rejeita
  palavras como "Amazing" ou "Do".
- **Celular**: em vez de `<pre>` com rolagem horizontal (comum em sites de cifra), cada palavra é
  um bloco que pode descer de linha; o acorde vai junto da sua sílaba.
