# Diário de bordo

Registro do que foi feito em cada fase, onde fica cada arquivo e por que as decisões foram tomadas.

---

## Operações: backup diário do banco (21/11/2026)

> Entrada no topo porque veio de um PR independente (ops/backup), que pode ser mergeado antes ou
> depois dos PRs de funcionalidade.

### O que foi feito

- **Repositório privado `gabryelcetto/ministerio-louvor-ops`** (criado com o `gh`): tem o
  workflow agendado `Backup do banco`, os scripts `backup.sh`/`restore.sh` e o README. Fica
  separado porque este repositório é público.
- `ops/backup/backup.sh` — `supabase db dump` de roles, schema e dados → `tar.gz` →
  criptografado com `age` usando a chave **pública** (secret). Falha se algum dump vier vazio.
- `ops/backup/restore.sh` — descriptografa com a chave **privada** e restaura com `psql`, na
  ordem e com as opções do guia oficial do Supabase.
- `ops/backup/backup.yml` — cópia versionada do workflow do repositório privado (aqui não roda).
- `ops/backup/README.md` — gerar as chaves, secrets, testar, restaurar num Supabase local.
- `.github/workflows/backup-selftest.yml` — **autoteste**: sobe o Supabase local com o seed,
  faz o backup com uma chave descartável, sobe um **segundo** Supabase local vazio (portas
  55xxx), restaura e compara a contagem de 10 tabelas e as policies.

### Decisões

- **Criptografia assimétrica (age):** o GitHub só tem a chave pública, que serve para trancar,
  não para abrir. Se o repositório (ou um artefato) vazar, o backup continua ilegível. A chave
  privada fica só com o dono.
- **Repositório privado:** artefatos de repositório público podem ser baixados por qualquer um;
  mesmo criptografado, um backup não deve ficar exposto.
- **Session pooler (IPv4) na conexão:** a conexão direta do plano grátis é só IPv6, e os runners
  do GitHub não alcançam IPv6.
- **CLI 3 do Supabase:** `db dump` usa `--remote=<url>` (a antiga `--db-url` não existe
  mais; conferido no `--help` da 3.2.0, a mesma versão fixada nos workflows).
- **Testar a restauração, não só o backup:** o autoteste roda em todo PR que mexe em
  `ops/backup/` e toda segunda-feira (pega mudança de comportamento da CLI).
- **Storage fora do dump:** `pg_dump` só leva o banco; os áudios precisam de cópia à parte.

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

---

## Fase D — Login e layout (19/11/2026)

### Arquivos criados/alterados

- `src/features/auth/session-context.ts` — contexto React da sessão + hook `useSession()`.
- `src/features/auth/session-provider.tsx` — lê a sessão salva, escuta login/logout/refresh do
  Supabase Auth e **limpa o cache** do TanStack Query ao trocar de usuário (evita mostrar dados do
  usuário anterior).
- `src/features/auth/api.ts` — `fetchMyProfile` (lista as colunas: `phone` não é legível),
  `fetchMyPermissions` (RPC `my_permissions`), `signIn`, `signOut`.
- `src/features/auth/hooks/use-me.ts` — `useMyProfile()` e `useMyPermissions()` (TanStack Query).
- `src/features/auth/components/login-page.tsx` — tela de login com React Hook Form + Zod, labels
  associados, mensagens de erro com `aria-describedby` e erros do Supabase traduzidos.
- `src/lib/permissions.ts` — `usePermission('chave')`: **só para a interface**.
- `src/app/protected-route.tsx` — guarda de rota: sem sessão → `/login` (lembra a página de
  origem); perfil inativo → tela "Acesso desativado".
- `src/app/app-shell.tsx` — layout: barra lateral no computador, barra inferior (5 itens) no
  celular, link "Pular para o conteúdo", `Configurações` só para quem tem `members.manage` ou
  `permissions.manage`.
- `src/app/router.tsx` — rotas `/login` (pública) e as rotas protegidas dentro do `AppShell`.
- `src/app/placeholder-page.tsx`, `src/app/home-page.tsx` — telas provisórias até a fase E.
- `src/components/ui/input.tsx`, `label.tsx` — componentes shadcn/ui.
- `src/main.tsx` — registra o service worker com aviso "nova versão disponível".

### Decisões

- **Permissões vêm do banco** (`my_permissions()` roda `has_permission` para cada chave), então a
  UI e o RLS usam exatamente a mesma regra — não há uma cópia da lógica no frontend.
- **Esconder item de menu não é segurança**: as rotas administrativas continuam protegidas pelo RLS.
- **Navegação mobile-first**: alvos de toque de 56px, `safe-area-inset-bottom` para iPhone.

---

## Fase E — Telas de leitura, parte 1 (19/11/2026)

### Arquivos criados/alterados

- `CLAUDE.md` — criado: fluxo de branches a partir da `main` (PR direto para a `main`, sem empilhar),
  coautoria em todo commit (inclusive merge), fim da regra 5.1 (limite das 05:00) e convenções.
- `src/types/database.types.ts` — **corrigido**:
  - as linhas (`ProfileRow`, `EventRow`, `SongRow`, `AnnouncementRow`, `Database`) eram
    `interface`; o supabase-js exige `Record<string, unknown>` e interface não tem assinatura de
    índice, então **todo select tipado virava `never`**. Agora são `type`;
  - `Relationships` preenchido para `event_assignments`, `event_songs` e `member_functions`
    (habilita selects aninhados tipados);
  - novos tipos `MinistryFunctionRow` e `Dashboard` (formato do JSON de `get_dashboard()`).
- `src/index.css` — tokens de cor por tipo de evento (`--event-culto`, `--event-ensaio`,
  `--event-evento` e versões `-soft`), claro e escuro.
- `src/lib/dates.ts` (+ teste) — datas no fuso `America/Sao_Paulo`: hora, dia, "Hoje"/"Amanhã",
  saudação e agrupamento por dia.
- `src/components/common/states.tsx` — estados de carregando, erro (com "Tentar de novo") e vazio.
- `src/features/agenda/event-type.ts` / `event-type-badge.tsx` — cor, ícone e rótulo de cada tipo
  (culto: igreja/azul; ensaio: nota musical/roxo; evento: calendário/dourado) e selo "Cancelado".
- `src/features/agenda/components/event-card.tsx` — cartão de evento com faixa lateral na cor do
  tipo; leva ao detalhe.
- `src/features/agenda/api.ts` + `components/agenda-page.tsx` — Agenda: eventos de hoje até 90
  dias, agrupados por dia, filtro por tipo e aviso "Você está escalado(a)".
- `src/features/escalas/schedule-utils.ts` (+ teste) — funções puras: agrupar atribuições por
  evento, separar próximas/anteriores, agrupar equipe por função e resolver o tom do dia.
- `src/features/escalas/api.ts`, `hooks.ts` — consultas de Minhas escalas e do detalhe do evento.
- `src/features/escalas/components/my-schedules-page.tsx` — Minhas escalas (próximas primeiro;
  anteriores dos últimos 60 dias recolhidas).
- `src/features/escalas/components/event-detail-page.tsx` — detalhe: dados do evento, equipe
  agrupada por função (você destacado) e repertório na ordem.
- `src/features/escalas/components/song-row.tsx` — linha do repertório com o tom em destaque e a
  origem do tom (tom do dia / oficial / original).
- `src/features/dashboard/api.ts` (+ teste) + `components/dashboard-page.tsx` — painel inicial.
- `src/app/router.tsx` — rotas `/`, `/escalas`, `/escalas/:eventId` e `/agenda`;
  `src/app/home-page.tsx` removido.

### Decisões

- **Dashboard em uma chamada só** (`get_dashboard()`), com `parseDashboard()` garantindo listas
  nunca nulas: a tela não precisa se defender de `null`.
- **Tom do dia com a mesma regra do banco**: tom do evento > tom oficial > tom original
  (`resolveEventKey`, igual ao `coalesce` do `get_dashboard`). No detalhe mostramos também de
  onde o tom veio, para o músico saber se é o tom combinado para aquele culto.
- **Detalhe do evento em `/escalas/:id`**: é o endereço que os triggers de notificação já gravam
  em `notifications.link`; Agenda e Dashboard apontam para o mesmo lugar.
- **Fuso fixo da igreja** em vez do fuso do aparelho: quem viaja continua vendo o horário do culto.
- **Tipo nunca só pela cor**: sempre ícone + texto junto (acessibilidade para daltonismo).
- **Evento em andamento continua em "Próximas"** (vale o término, não o início).

---

## Fase E — Telas de leitura, parte 2 (19/11/2026)

### Arquivos criados/alterados

- `src/features/repertorio/song-key.ts` (+ teste) — lógica pura da tela da música: tom-base da
  cifra (`{key}` ou tom original), semitons pelo caminho mais curto (−5…+6), tom atual, opções do
  seletor no mesmo modo (maior/menor), link de mídia seguro (só `http(s)`) e categorias distintas.
- `src/features/repertorio/api.ts` — `search_songs` (busca sem acento no banco) com
  `.eq('category', …)` sobre o resultado, categorias para os filtros e a música com letra e cifra.
- `src/features/repertorio/components/songs-page.tsx` — lista com busca (espera 250 ms após a
  digitação), filtro por categoria e estado na URL (`?busca=&categoria=`).
- `src/features/repertorio/components/song-page.tsx` — música: abas **Cifra** e **Letra**
  (acessíveis por teclado), seletor de tom com − / + e "Tom oficial", tamanho da letra (A− / A+,
  salvo no navegador), aviso de cifra `pending`, link de mídia.
- `src/features/repertorio/components/chord-sheet.tsx` — acordes na cor `--chord` (dourado com
  contraste) e em `em`, para acompanharem o tamanho da letra.
- `src/features/escalas/components/song-row.tsx` — o link da música no repertório de um evento leva
  `?tom=<tom do dia>`.
- `src/features/notificacoes/api.ts` (+ teste) + `components/notifications-page.tsx` — lista
  (lidas e não lidas), filtro "Não lidas", marcar uma / marcar todas, contador de não lidas.
- `src/features/comunicados/api.ts` + `components/announcements-page.tsx` — do mais recente, com
  autor e selo "Agendado" (só quem gerencia comunicados enxerga os futuros, pelo RLS).
- `src/features/integrantes/api.ts` (+ teste) + `components/members-page.tsx` — nome, papel e
  funções; telefone só com `members.view_contacts`; inativos só para `members.manage`.
- `src/app/app-shell.tsx`, `src/app/nav.ts` (+ teste) — barra inferior com 4 itens + **Mais**;
  sino com contador no topo do celular; contador também na barra lateral.
- `src/app/router.tsx` — rotas `/repertorio`, `/repertorio/:songId`, `/notificacoes`,
  `/comunicados`, `/integrantes`.
- `src/types/database.types.ts` — FKs 1-para-1 (`song_lyrics`, `song_chords` → `songs`),
  `song_favorites → songs` e `announcements.created_by → profiles`.
- `src/index.css` — tokens `--chord` e `--overlay`.
- `docs/roteiro-de-teste.md` — roteiro por tela para integrante e admin.

### Decisões

- **Tom guardado na URL** (`?tom=A`): recarregar, voltar e compartilhar mantêm o tom, e o
  repertório de um culto abre a música direto no tom do dia. Sem `?tom`, abre no **tom oficial**
  (o que a banda toca); sem tom oficial, no tom em que a cifra foi escrita.
- **Estado = semitons em relação à cifra escrita**, sempre normalizado para −5…+6: os acordes
  ficam com a grafia do tom de destino e o botão "+" nunca acumula voltas.
- **Barra de tom fixa embaixo** (acima da navegação) no celular, botões de 48 px: dá para trocar
  de tom com o polegar segurando o celular. O tamanho da letra fica junto das abas, porque se
  ajusta uma vez e não durante a música.
- **Barra inferior com 4 itens + "Mais"**: com 6 itens o rótulo "Notificações" não cabe em
  telas de 360–390 px. Notificações ganhou um sino com contador no topo da tela e também aparece no
  "Mais"; Comunicados, Integrantes e Configurações (esta só para admin) ficam no "Mais".
- **Menu "Mais" com `<dialog>` nativo**: prende o foco, fecha com Esc e devolve o foco ao botão
  sem biblioteca extra.
- **Telefone nunca é pedido sem permissão**: sem `members.view_contacts` o app nem chama
  `get_member_contacts` (o banco devolveria só o próprio telefone, mas assim nada trafega à toa).
- **Links vindos do banco são filtrados**: notificações só seguem caminhos internos (`/…`) e o
  link de mídia só aceita `http(s)`.

---

## Dados de demonstração e privacidade (19/11/2026)

### Arquivos alterados

- `supabase/seed.sql` — os 10 hinos em inglês saíram. Mesmos 12 ids, tons e categorias (o
  repertório dos cultos e as escalas continuam apontando para as mesmas músicas):
  - 4 hinos em português de domínio público (só a 1ª estrofe): "Santo! Santo! Santo!" e "Mais
    Perto Quero Estar" (trad. João Gomes da Rocha, 1861–1947), "Sou Feliz com Jesus" (trad. W. E.
    Entzminger, 1859–1930) e "Doxologia" (trad. Sarah P. Kalley, 1825–1907);
  - 6 textos fictícios novos marcados "(exemplo)", além dos 2 que já existiam.
  - "Mais Perto Quero Estar" ficou com a cifra `pending` e sem tom oficial (o papel que era do
    "Rock of Ages"), para demonstrar a revisão de cifra.
- `src/lib/chords/seed.test.ts` — lê o `seed.sql` (import `?raw`) e confere, sem banco: 10 a 12
  músicas, toda música com letra e cifra, cifras ChordPro com acordes reconhecidos, `{key}` igual
  ao tom original e letra igual à cifra sem acordes.
- `supabase/demo-users.sql` — antes dos `update`, cria o perfil de quem ainda não tem (mesma regra
  do trigger `handle_new_user`, `on conflict do nothing`). Antes, um usuário criado sem o trigger
  ficava sem perfil e o script "passava" sem atualizar nada.
- `index.html` — `<meta name="robots" content="noindex, nofollow">`.
- `public/robots.txt` — `Disallow: /` para todos os robôs.
- `package.json` / `package-lock.json` — `"license": "UNLICENSED"` (código sem licença de uso
  para terceiros, mesmo com o repositório público).

### Decisões

- **Domínio público pelo autor do texto em português**, não pelo autor original: a tradução é uma
  obra própria. Regra usada: tradutor falecido há mais de 70 anos (antes de 1956), conferido no
  hymnary.org. Na dúvida (ex.: "Castelo Forte", data de morte do tradutor não encontrada),
  texto fictício.
- **Mesmos ids e tons**: nada que referencia as músicas (event_songs, testes, roteiro) precisa
  mudar.
- **`noindex` em dois lugares**: o `robots.txt` pede para não rastrear; a meta tag cobre quem
  chega à página por link direto. Nenhum dos dois é segurança — os dados continuam protegidos
  pelo login e pelo RLS.
- **Lockfile editado à mão**: `npm install --package-lock-only` com outra versão do npm reescrevia
  81 linhas sem relação com a mudança.

---

## Fase F — Edição, histórico e escalas (19/11/2026)

### Arquivos criados/alterados

- `src/lib/errors.ts` (+ teste) — **utilitário único de erros**: `friendlyError(error, fallback)`
  traduz RLS/GRANT (42501), mensagens dos triggers (já em português, passam como estão),
  constraints conhecidas (escala duplicada, término antes do início, música em uso), rede, sessão
  expirada e login. `requireAffected()` + `NoRowsAffectedError` tratam o caso em que o RLS barra um
  UPDATE/DELETE sem erro (0 linhas). O login passou a usar o mesmo utilitário.
- `src/components/common/confirm-dialog.tsx`, `form-error.tsx`, `use-unsaved-guard.tsx` —
  confirmação com `<dialog>` nativo, erro de ação já traduzido e aviso ao sair com alterações
  (`useBlocker` do React Router + `beforeunload`).
- `src/components/ui/textarea.tsx` — componente shadcn/ui.
- `src/features/repertorio/editing.ts` (+ teste) — salvar letra (`upsert`), cifra (`upsert`, volta
  a `official`), tom oficial (`update`), histórico (`song_versions` + autor) e restaurar
  (`restore_song_version`); invalidação por tipo de alteração.
- `src/features/repertorio/editor-checks.ts` — avisos da cifra (acorde não reconhecido, colchete
  sem par, sem `{key}`) e letra extraída da cifra.
- `src/features/repertorio/history-format.ts` (+ teste) — rótulos, resumo de cada alteração e
  diferença dos "dados da música" (JSON).
- `src/features/repertorio/components/song-editors.tsx` — editores de letra, cifra (com
  pré-visualização em `<ChordSheet>` lado a lado; no celular, alterna Editar/Pré-visualizar) e tom
  oficial.
- `src/features/repertorio/components/song-page.tsx` — botões por permissão e editores nas abas.
- `src/features/repertorio/components/song-history-page.tsx` — `/repertorio/:id/historico`.
- `src/lib/chords/notes.ts`, `chord.ts`, `chordpro.ts` (+ testes) — `spellPitchInKey`: cada nota
  (tônica e baixo) é escrita pelo **grau** no tom de destino (pendência 12).
- `src/lib/dates.ts` (+ teste) — `zonedLocalToIso` / `isoToZonedLocal` para `datetime-local` no
  horário de São Paulo.
- `src/features/escalas/manage.ts` (+ teste) + `components/schedule-builder-page.tsx` — montar
  escala em `/escalas/montar` (`?evento=` para um evento existente); botões em Minhas escalas e no
  detalhe do evento.
- `src/types/database.types.ts` — FK `song_versions.changed_by → profiles`.

### Decisões

- **A interface esconde, o banco decide.** Botões aparecem por `usePermission`, mas toda escrita
  vai direto ao banco e o erro é traduzido; nada de "checar permissão" de novo no cliente.
- **Toda escrita pede `.select()`**: sem isso, um UPDATE barrado pelo RLS parece sucesso.
- **Mensagens dos triggers passam direto**: já são escritas em português para o usuário. Mensagens
  nativas (inglês) nunca chegam à tela — viram texto genérico. O critério é simples: a mensagem
  tem acento.
- **Restaurar = voltar ao conteúdo daquela versão** (é o que `restore_song_version` faz com o
  `new_value`). Por isso o histórico mostra o valor anterior **e** o conteúdo da versão, e a versão
  mais recente de cada campo fica marcada "versão atual", sem botão.
- **Quem salva a cifra oficial também aprova**: o `upsert` manda `review_status = 'official'`.
  Quem não tem a permissão nem vê o editor; se forçar, o banco recusa.
- **Grafia pelo grau** (1, b2, 2, b3, 3, 4, #4, 5, b6, 6, b7, 7): é a convenção de partitura. Vale
  igual para tom menor (em Am: C, C#, F, G#), cobre a 3ª/7ª maiores dos acordes de dominante e,
  se a nota exigir dobrado sustenido/bemol, cai na grafia simples do tom.
- **Invalidação por alcance**: letra/cifra recarregam a música e o histórico; tom oficial e
  restauração também a lista, o Início e o detalhe dos eventos (que mostram o tom resolvido);
  escala recarrega agenda, eventos, Minhas escalas, Início e notificações.
- **Montar escala respeita as duas permissões do banco**: criar evento é `events.manage`, incluir
  pessoas é `schedules.manage`. Sem a primeira, a tela só oferece eventos já existentes.
- **Horário digitado é de Brasília**, não do aparelho (mesmo critério de exibição desde a fase E).

---

## Configurações, instalação do app, ícone e README (19/11/2026)

### Arquivos criados/alterados

- `src/features/configuracoes/components/settings-page.tsx` — `/configuracoes` para **todos**
  (antes era item só de admin e tela provisória): meu perfil (nome, como aparece, e-mail, papel,
  funções — só leitura), aparência (claro / escuro / sistema), aplicativo (instalar) e sair.
- `src/lib/theme.ts` (+ teste) — preferência de tema no `localStorage` (`tema`) e
  `<html data-theme>`; o `index.html` aplica antes da primeira pintura.
- `src/index.css` — o bloco de cores escuras vale para "sistema escuro, a menos que a pessoa
  escolheu claro" (`:root:not([data-theme='light'])` dentro do `@media`) e para "escolheu escuro"
  (`:root[data-theme='dark']`); `color-scheme` acompanha (campos nativos no tema certo). Um teste
  garante que os dois blocos têm as mesmas cores.
- `src/lib/install.ts` (+ teste) — captura `beforeinstallprompt`/`appinstalled` desde o
  `main.tsx`, detecta iPhone/iPad (inclusive iPad que se apresenta como Mac) e app já instalado
  (`display-mode: standalone`).
- `src/features/instalar/components/` — botão "Instalar app", página `/instalar` (passo a passo do
  iPhone: Compartilhar → Adicionar à Tela de Início; instruções genéricas para outros navegadores)
  e o aviso dispensável no Início.
- `scripts/generate-icons.mjs` — ícone novo: colcheia azul-marinho com bandeirola dourada sobre
  fundo creme, desenhada por formas geométricas com antialiasing (supersampling 4×4), em PNG RGBA
  e o mesmo desenho em SVG (favicon). `public/*.png` e `public/favicon.svg` regerados.
- `vite.config.ts` — `background_color` do manifesto no creme do ícone (tela de abertura).
- `README.md` — o que é, stack, como rodar, Supabase (`link`, `db push --include-seed`,
  `demo-users.sql`), publicar e licença proprietária.
- `src/app/placeholder-page.tsx` — removido (não há mais tela provisória).

### Decisões

- **Tema só no navegador**: é preferência de tela, não dado do ministério; não precisa de banco
  nem de migration. "Sistema" é o padrão e não grava nada.
- **Script de tema inline no `index.html`**: sem ele, quem escolheu "escuro" veria a tela clara
  piscar até o React carregar.
- **`beforeinstallprompt` capturado no `main.tsx`**, antes do React: o Chrome dispara cedo, e uma
  tela que montasse depois perderia o evento. O app chama `preventDefault()` para não mostrar a
  faixa automática e oferece no Início/Configurações.
- **Aviso no Início só quando dá para instalar** (Chrome oferecendo, ou iPhone) e ainda não
  instalado; dispensado, não volta (`localStorage`). No Firefox do computador não aparece, porque
  não há como instalar.
- **Ícone "any" com cantos arredondados e transparência; maskable e apple-touch de borda a
  borda**, com o desenho reduzido para a zona segura (o sistema recorta em círculo/squircle).
- **README sem segredos**: só a chave pública vai para o `.env.local`; o passo a passo reforça que
  a `service_role` nunca entra no frontend.

---

## Deploy do banco pelo GitHub Actions (19/11/2026)

### Arquivos criados/alterados

- `.github/workflows/deploy-db.yml` — workflow **"Deploy banco"**, só por disparo manual
  (`workflow_dispatch`) com o input booleano `include_seed` (padrão `false`). Passos: checkout →
  `supabase/setup-cli` → confere se secrets/variable existem (sem imprimir valores) →
  `supabase link --project-ref $SUPABASE_PROJECT_REF` → prévia (`db push --dry-run`) →
  `supabase db push` (com `--include-seed` só se o input for `true`).
- `README.md` — seção "Deploy do banco pelo GitHub Actions": o que criar, onde e como rodar.

### O que configurar (GitHub → Settings → Environments → `staging`)

- **Secrets:** `SUPABASE_ACCESS_TOKEN` (token pessoal em supabase.com/dashboard/account/tokens) e
  `SUPABASE_DB_PASSWORD` (senha do banco do projeto).
- **Variable:** `SUPABASE_PROJECT_REF` (código do projeto na URL do painel).
- **Opcional:** "Required reviewers" no `staging` para exigir aprovação antes de cada deploy.
- **Rodar:** Actions → **Deploy banco** → **Run workflow** → escolher a branch e se inclui o seed.

### Decisões

- **Environment `staging` no job:** os segredos ficam presos a esse ambiente (outros workflows não
  os enxergam) e dá para ligar aprovação manual depois, sem mudar o workflow.
- **Segredos só por variável de ambiente:** a CLI lê `SUPABASE_ACCESS_TOKEN` e
  `SUPABASE_DB_PASSWORD` do ambiente, então nada sensível vai para a linha de comando; nenhum
  `echo` de segredo e nenhum `set -x`. O passo de conferência só testa se a variável está vazia.
- **Inputs e variables via `env`, não interpolados no script** (`${{ }}` dentro de `run:` abre
  espaço para injeção de comando).
- **`concurrency` sem cancelar:** dois deploys no mesmo banco nunca rodam juntos; o segundo
  espera o primeiro.
- **`permissions: contents: read`:** o workflow só lê o repositório.
- **Prévia antes de aplicar:** o `--dry-run` deixa no log a lista de migrations, útil para quem
  aprova ou para entender um erro.
- **`--linked --yes` + `SUPABASE_YES`:** explícitos para funcionar na CLI v2 e na v3 (que passou a
  tratar os comandos de banco como locais por padrão e pede confirmação para o projeto hospedado).
  Ver pendência 21.

---

## Validação com dados reais (20/11/2026)

Objetivo: rodar o app inteiro contra um Supabase de verdade (migrations + seed + usuários demo) e
corrigir o que quebrasse.

### Como foi feito

- O plano era usar o Supabase local nesta máquina, mas o disco C: lotou durante o download da
  imagem do Postgres e o Docker Desktop ficou danificado (pendência 22). A validação foi movida
  para o **GitHub Actions**, que roda o mesmo Supabase local em Docker num runner limpo.
- Novo workflow `.github/workflows/e2e.yml` (**E2E (dados reais)**), em todo PR: sobe Postgres,
  Auth, PostgREST e o gateway (`supabase start -x …` exclui o que o app não usa) → `supabase test
db` → `supabase gen types` → cria os 3 usuários demo pela Auth admin API com **senha aleatória
  da execução** (mascarada no log) → roda `supabase/demo-users.sql` → testes de API → sobe o
  `npm run dev` apontando para o banco local → Playwright → envia capturas e relatórios como
  artefato.

### Arquivos criados/alterados

- `.github/workflows/e2e.yml` — o workflow acima. Cada etapa de teste roda mesmo se a anterior
  falhar (`if: !cancelled() && …`), para o relatório mostrar todos os problemas de uma vez.
- `e2e/create-demo-users.mjs` — cria `admin@`, `lider@` e `integrante@demo.local` pela Auth
  admin API (só em banco local; a chave `service_role` vem do `supabase status`).
- `e2e/api-checks.mjs` — 12 verificações chamando o Supabase **direto**, sem a interface (como
  alguém mexendo no console do navegador): integrante não edita cifra (upsert → 42501; update →
  0 linhas), não restaura versão, não muda tom oficial, não lê `phone`, só vê as próprias
  notificações, não cria evento; líder vê telefones e não se promove a admin.
- `e2e/varredura.mjs` — entra com cada perfil, no celular (390×844) e no computador, abre 14
  telas e procura erro de API (HTTP ≥ 400), erro de console, mensagem de erro na tela e **rolagem
  lateral**. Salva captura de cada tela.
- `e2e/fluxos.mjs` — o roteiro de `docs/roteiro-de-teste.md` em 29 passos: busca sem acento,
  abrir no tom do dia, transpor, seletor de tom, editar letra, editar cifra, tom oficial,
  histórico e restaurar, montar escala (validação + evento com 2 pessoas às 19:30), notificação
  chegando, marcar como lidas, telefones só para quem pode, menu "Mais" (foco volta ao botão).
- `src/types/database.types.ts` — agora é o arquivo **gerado** pelo Supabase.
- `src/types/app.types.ts` — novo: tipos de domínio, `AppDatabase` (o gerado com as colunas de
  CHECK estreitadas) e o formato do `get_dashboard`.
- `src/lib/supabase.ts` e 16 arquivos de `src/features` — importam de `@/types/app.types`.
- 8 telas (`dashboard`, `event-detail`, `members`, `settings`, `schedule-builder`, `song-editors`,
  `song-history`, `app-shell`) — correção de layout (abaixo).
- `.github/workflows/ci.yml` e `e2e.yml` — CLI do Supabase com versão fixa (`3.2.0`).
- `docs/capturas/` — capturas das telas principais no celular, usadas no PR.
- `README.md`, `CLAUDE.md`, `docs/roteiro-de-teste.md`, `docs/pendencias.md` — atualizados.

### Erros encontrados e corrigidos

1. **Início mais largo que o celular (617 px numa tela de 390 px).** Grades `grid` sem coluna
   definida no celular criam uma coluna `auto`, que cresce até caber o maior texto, mesmo com
   `truncate`. Os autores longos do seed ("Reginald Heber (1826), trad. João Gomes da Rocha…")
   empurravam a página, e o botão "Mais" ficava fora da tela. Correção: `grid-cols-1`
   (`minmax(0, 1fr)`) em todas as grades responsivas e `minmax(0,1fr)` na coluna de conteúdo do
   layout do computador. **Lição:** em CSS Grid, item com texto que não quebra precisa de trilha
   `minmax(0, …)` (ou `min-w-0`) para encolher.
2. **A varredura não via a rolagem lateral.** Em modo celular o navegador alarga a janela junto
   com a página (como o zoom automático do celular), então `scrollWidth > innerWidth` dava
   falso. Agora compara com a largura configurada (390).
3. **CI instável:** `setup-cli` com `version: latest` falhou por limite de requisições da API do
   GitHub. Versão fixada.
4. **Tipos à mão x gerados:** os nomes das FKs deduzidos estavam certos; a diferença era que o
   gerador devolve `string` para colunas com CHECK. `app.types.ts` estreita essas colunas, e uma
   checagem temporária com `@ts-expect-error` confirmou que os selects não viraram `any`.

### O que funcionou de primeira com dados reais

pgTAP (todos), RLS de `profiles`, selects aninhados com as FKs, `get_dashboard`, busca sem acento
com filtro de categoria, contagem de não lidas, `read_at` com GRANT de coluna,
`get_member_contacts`, recusas 42501 com mensagem em português e as notificações geradas por
trigger.

### Decisões

- **E2E no CI em vez de só na máquina do dono:** o teste com dados reais passa a rodar em todo
  PR, num ambiente limpo e igual para todos. É o mesmo princípio de DevOps de "a pipeline é a
  fonte da verdade".
- **Playwright fora do `package.json`** (`npm i --no-save` no CI): ninguém precisa baixar
  navegador só para rodar `npm ci`.
- **Senha dos usuários demo gerada a cada execução** e mascarada no log: nada de senha no
  repositório, nem de teste.

---

## GRANT explícito — o 403 do banco da nuvem (20/11/2026)

### O problema

No projeto da nuvem quase toda chamada à API respondia **403**. Projetos **novos** do Supabase
deixaram de conceder `SELECT/INSERT/UPDATE/DELETE` nas tabelas de `public` para `anon` e
`authenticated`; o Supabase **local** (usado no CI e no E2E) ainda concede tudo. Como o Postgres
confere o privilégio de tabela (GRANT) **antes** do RLS, sem GRANT a requisição morre com
`permission denied for table …` (42501 → HTTP 403), mesmo com as policies certas. Os testes não
pegaram porque o ambiente de teste era mais permissivo que a produção.

**Lição de DevOps:** o ambiente de teste precisa ser igual à produção no que importa. Aqui a
diferença era invisível (privilégios padrão do banco) e só apareceu em produção.

### Arquivos criados/alterados

- `supabase/migrations/20261120200000_explicit_grants.sql` — nova migration: `usage` no schema
  `public`; zera os privilégios de `anon`/`authenticated`; concede `select/insert/update/delete`
  em todas as tabelas e `usage/select` nas sequences para `authenticated`; define os mesmos
  **privilégios padrão** para objetos futuros criados pelo `postgres`; e reaplica as restrições
  de coluna de `profiles` (select sem `phone`, update só em `full_name`, `display_name`, `phone`,
  `access_role`, `status`) e `notifications` (só update de `read_at`). Nada para `anon`.
- `supabase/ci/simular-nuvem.sql` — script que faz o Supabase local se comportar como um projeto
  novo da nuvem (revoga os privilégios padrão de `anon`/`authenticated`). O CI e o E2E copiam o
  arquivo para `supabase/migrations/00000000000000_simular_nuvem.sql` antes de subir o banco: o
  nome com zeros faz rodar antes de todas as migrations. Essa cópia está no `.gitignore`.
- `supabase/tests/privileges.test.sql` — testes pgTAP lendo o catálogo: cada tabela de `public`
  tem exatamente `DELETE/INSERT/SELECT/UPDATE` para `authenticated` (exceto `profiles`, só por
  coluna, e `notifications`, só `SELECT` + update de `read_at`) e **nada** para `anon`;
  sequences; colunas de `profiles`/`notifications`; RLS ligado em toda tabela; `usage` no schema;
  privilégios padrão. Tabela nova entra no teste sozinha.
- `supabase/tests/rls.test.sql` — o anônimo agora recebe **erro de permissão** (42501) em vez de
  lista vazia, que é o comportamento real da nuvem.
- `scripts/check-grants.mjs` + `npm run check:grants` — falha se uma migration nova criar tabela
  sem `grant … to authenticated` (exceção só com `-- sem-grant: public.<tabela> — motivo`).
- `.github/workflows/ci.yml` — job `app` roda `check:grants`; job `db` simula a nuvem antes das
  migrations e, depois dos testes, prova a **idempotência**: aplica um `grant all` (inclusive para
  `anon`, simulando uma correção manual mais larga), reaplica a migration duas vezes e roda o
  pgTAP de novo.
- `.github/workflows/e2e.yml` — também simula a nuvem antes de subir o Supabase.
- `CLAUDE.md` — regra: toda tabela nova com GRANT explícito; nada para `anon`.

### Como provamos que o CI pega o problema

1. Primeiro commit do PR: só a simulação da nuvem + os testes novos, **sem** a migration. O CI
   falhou do jeito esperado: 23 testes de privilégio, `rls.test.sql` abortando com
   `permission denied for table songs`, e o E2E com o mesmo erro da nuvem,
   `403 POST /rest/v1/rpc/get_dashboard — permission denied for table events`.
2. Segundo commit: a migration. Tudo verde.

Achado extra no passo 1: `notifications` também quebrava na nuvem. A migration antiga tirava
INSERT/UPDATE/DELETE e contava com o SELECT padrão do Supabase.

### Decisões

- **Revogar tudo e conceder de novo** (em vez de só conceder): o resultado final não depende do
  que havia antes — nem da correção manual feita na nuvem, nem do `TRUNCATE`/`REFERENCES`/
  `TRIGGER` que o Supabase local dá. Isso é o que torna a migration idempotente. Atenção: em
  PostgreSQL, revogar um privilégio de tabela também revoga os de coluna; por isso as regras de
  `profiles`/`notifications` vêm **depois**.
- **Privilégios padrão para `authenticated`:** rede de segurança para não repetir o 403. Como eles
  escondem um GRANT esquecido, a regra explícita é garantida pelo `check:grants`.
- **Nada para `anon`:** o app só fala com o banco depois do login (o login é o Auth, não o
  PostgREST). Menos superfície de ataque.
- **Mantido o pedido "select/insert/update/delete em todas as tabelas"**, inclusive em
  `song_versions` e `audit_logs` (só inserção). Quem barra as escritas indevidas nelas é o RLS
  (sem policy de update/delete). Ver pendência 27.

---

## Cadastro de integrantes e primeiro acesso (20–21/11/2026)

### Parte 1 (GRANTs) — já estava na `main`

O pedido repetia a correção do 403 da nuvem, que entrou na `main` pelo PR #11:

- migration `20261120200000_explicit_grants.sql` (idempotente; nada para `anon`);
- CI e E2E simulando a nuvem (`supabase/ci/simular-nuvem.sql`);
- `supabase/tests/privileges.test.sql`;
- regra no `CLAUDE.md`, reforçada por `npm run check:grants`.

Nesta entrega a regra foi seguida: a coluna nova ganhou GRANT só de leitura, o
`privileges.test.sql` passou a cobri-la, e a prova de idempotência do CI agora reaplica **todas**
as migrations a partir da de GRANT.

### Como funciona

1. Quem tem `members.manage` abre **Integrantes → Cadastrar integrante** e informa nome, e-mail,
   funções e perfil.
2. O app chama a **Edge Function `invite-member`** (Deno, roda no Supabase, não no navegador):
   - valida o JWT;
   - confere `has_permission('members.manage')` **chamando o banco como o próprio usuário**;
   - só então usa a service role para `auth.admin.createUser` (e-mail confirmado, senha provisória
     gerada no servidor);
   - grava perfil e funções pela RPC `setup_new_member`, de novo como o usuário;
   - devolve a senha uma única vez.
3. A tela mostra a senha com "Copiar senha", "Copiar mensagem" e "Enviar pelo WhatsApp", e avisa
   que ela não aparece de novo.
4. A pessoa entra com a provisória e cai em **"Defina sua senha"**. Ao salvar, o app troca a senha
   no Auth e chama `complete_password_change()`, e a flag `must_change_password` vira `false`.

### Arquivos criados/alterados

- `supabase/migrations/20261121090000_member_onboarding.sql`:
  - coluna `profiles.must_change_password` (GRANT de **select** na coluna; nenhum update pela API);
  - `is_active_member`/`has_permission` tratam a conta com senha provisória como **sem acesso**;
  - RPC `setup_new_member` (`members.manage`; líder/admin só com `permissions.manage`; só contas
    recém-criadas e que nunca entraram; registra em `audit_logs`);
  - RPC `complete_password_change` (só o próprio usuário).
- `supabase/functions/invite-member/index.ts` (+ `deno.json`) — a Edge Function.
- `supabase/functions/_shared/password.ts` e `invite.ts` — regra de senha, gerador da senha
  provisória e validação dos dados. TypeScript puro, **o mesmo código** roda no Deno (função) e
  no navegador (app).
- `supabase/config.toml` — senha com mínimo de 10 e "letters_digits"; `verify_jwt` da função.
- `src/lib/password.ts` (+ teste) — reexporta a regra e monta o schema de "nova senha".
- `src/features/integrantes/invite.ts` (+ teste) — chamada da função, mensagem de WhatsApp,
  schema do formulário.
- `src/features/integrantes/components/invite-member-page.tsx` — tela "Cadastrar integrante".
- `src/features/integrantes/components/members-page.tsx` — botão (só com `members.manage`).
- `src/features/auth/components/password-form.tsx` — formulário de senha (primeiro acesso e
  Configurações; em Configurações confere a senha atual antes).
- `src/features/auth/components/first-access-page.tsx` — "Defina sua senha".
- `src/app/protected-route.tsx` — bloqueia o app inteiro enquanto `must_change_password`.
- `src/features/configuracoes/components/settings-page.tsx` — card "Trocar senha".
- `src/features/auth/api.ts` — lê a flag; `changePassword()`.
- `src/features/auth/session-cache.ts` (+ teste) e `session-provider.tsx` — correção de bug
  (abaixo).
- `src/lib/errors.ts` (+ teste) — `UserFacingError` e mensagens do Auth (`same_password`,
  `weak_password`).
- `src/types/database.types.ts` — regenerado (cópia exata do gerado no CI).
- `supabase/tests/members.test.sql` (24 testes) e `privileges.test.sql` (coluna nova).
- `e2e/api-checks.mjs` (+11 verificações da função) e `e2e/fluxos.mjs` (+12 passos).
- `.github/workflows/ci.yml`:
  - `deno check` da função;
  - prova de idempotência reaplicando as migrations a partir da de GRANT.
- `.github/workflows/e2e.yml`:
  - sobe o edge-runtime e confere que a função responde;
  - senha demo com letras e números garantidos.
- `README.md`, `docs/roteiro-de-teste.md`, `docs/pendencias.md`.

### Decisões

- **A service role só faz o que exige o Auth admin** (criar e, se algo falhar, apagar a conta).
  Perfil, funções e a regra "líder/admin só com `permissions.manage`" ficam no banco, numa RPC
  chamada **como o usuário logado**. Assim:
  - a autorização continua no Postgres e testável no pgTAP;
  - a função não depende de a service role ter GRANT nas tabelas (o mesmo tipo de surpresa do 403).
- **Checagem dupla de permissão** (na função e na RPC): a da função evita criar uma conta à toa;
  a da RPC é a que vale.
- **Desfazer em caso de erro:** se `setup_new_member` falhar, a função apaga a conta recém-criada.
- **Bloqueio também no banco:** com `must_change_password = true`, `is_active_member()` e
  `has_permission()` devolvem `false`. Quem souber a senha provisória (inclusive quem cadastrou)
  não lê nada pela API até a pessoa criar a própria senha.
- **`setup_new_member` só em conta recém-criada** (até 10 min e sem login): a RPC não vira um
  jeito de mudar perfil de quem já existe.
- **Senha provisória:** 16 caracteres (≈ 92 bits) em 4 grupos (`Kp7m-Xq2r-8ZtA-w3Nd`), sem
  caracteres que se confundem (0/O, 1/l/I). Resposta com `Cache-Control: no-store`.
- **Regra de senha numa fonte só** (`_shared/password.ts`), igual à do Auth. O Auth só conta
  A–Z como letra, por isso "ç" não vale como letra.
- **Trocar senha confere a senha atual:** quem pegar o celular desbloqueado não troca a senha.

### Bugs encontrados pelo E2E (e corrigidos)

1. **"Trocar senha" desmontava a tela.** O `SessionProvider` limpava todo o cache em qualquer
   `SIGNED_IN`. O Supabase emite esse evento também para o **mesmo usuário**: ao recarregar a
   página e quando "Trocar senha" confere a senha atual com `signInWithPassword`. A tela voltava
   para "Carregando…" e a mensagem "Senha alterada." nunca aparecia. Agora a função
   `shouldClearCache` (com teste) só limpa ao sair ou quando entra **outra** pessoa.
2. **Aviso "não será mostrada de novo" em colunas.** Texto e `<strong>` soltos dentro de um
   contêiner flex viravam três colunas; agora ficam num único `<span>`.

---

## Base ADVOP: perfis, nova música com cifra colada e atividade recente (21/11/2026)

### Arquivos criados/alterados

- `supabase/migrations/20261122090000_advop_roles_songs.sql`:
  - quem era `leader` vira `member`, e uma CHECK impede voltar (o valor continua no enum:
    remover valor de enum exige recriar o tipo);
  - `ministry_functions.section` (`vocal`/`instrumental`): só selos e filtros;
  - permissões `songs.manage` e `history.view_all`; o padrão do integrante passa a ser cifra,
    tom oficial e cadastro de música; o resto é só do admin (o catálogo completo de permissões
    também fica na migration, porque num banco novo ela roda antes do seed);
  - fim do fluxo de cifra "pendente" (trigger removido; pendentes viram oficiais);
  - policies novas de `songs` + trigger `guard_song_changes` (dados → `songs.manage`;
    `archived_at` → `songs.delete`; ninguém troca `created_by`);
  - `log_song_archive` (arquivar/desarquivar vai para `audit_logs`);
  - RPC `create_song` (música + letra + cifra numa transação; entra no histórico);
  - RPC `get_recent_activity` (só `history.view_all`);
  - `setup_new_member` sem `leader`.
- `src/lib/chords/paste.ts` (+ testes): cifra colada → ChordPro. Detecta o formato, entende
  `[Refrão]`, `[Intro] G D`, "Parte 1 de 2" e espaço não separável de páginas web; sugere o tom
  (`guessKey`) e gera a letra (`lyricsFromChordPro`).
- `src/features/repertorio/song-data.ts` (+ teste): validação e chamadas de cadastrar, editar
  dados e arquivar.
- `src/features/repertorio/components/new-song-page.tsx`: tela "Nova música".
- `song-data-fields.tsx`: campos de dados, usados em cadastrar e editar.
- `song-data-editor.tsx`: "Editar dados" e "Arquivar".
- `song-page.tsx`, `songs-page.tsx`, `song-editors.tsx`: botões novos e o conversor novo no
  editor de cifra.
- `src/features/atividade/`: API (+ teste) e tela "Atividade recente".
- `src/features/integrantes/sections.ts` (+ teste): selos Cantor(a)/Instrumentista e filtro.
- `members-page.tsx`, `api.ts`, `escalas/manage.ts`, `schedule-builder-page.tsx`: selos e
  filtro Cantores/Instrumentistas.
- `src/config/brand.ts`: identidade ADVOP, usada em `vite.config.ts` (manifest e título via
  `%BRAND_TITLE%` no `index.html`), login, topo, Início e mensagem de convite.
- `src/app/app-shell.tsx`: itens do menu por permissão (`permission`), incluindo "Atividade
  recente".
- `supabase/seed.sql` e `supabase/demo-users.sql`: mesmo estado final da migration.
- Cadastro de integrante sem "Liderança": `_shared/invite.ts`, `invite.ts`, tela e Edge Function.
- Testes:
  - `supabase/tests/advop.test.sql` (30, novo);
  - `rls.test.sql` reescrito para o modelo novo (o "sem permissão" agora usa exceções `deny`);
  - `members.test.sql` sem líder;
  - E2E com nova música, atividade, arquivar, filtro de escala e ex-líder;
  - verificações de API do modelo ADVOP.

### Decisões

- **Grupo não é permissão:** "cantor/instrumentista" sai das funções da pessoa e só muda selos e
  filtros. Assim uma pessoa que canta e toca não precisa de dois perfis, e permissão continua num
  lugar só (`has_permission`).
- **Uma policy de UPDATE larga + trigger por coluna** em `songs`: RLS decide por linha, não por
  coluna. Quem pode mexer em alguma parte passa na policy, e o trigger confere cada parte (dados,
  tom oficial, arquivamento). Quem não pode mexer em nada nem enxerga a linha no UPDATE (0 linhas).
- **`create_song` como RPC "invoker":** as regras de RLS e os triggers de histórico valem, e
  música, letra e cifra entram juntas ou nada entra.
- **Atividade recente:** o histórico de cada música continua aberto a todos (`song_versions`); o
  que é restrito é a visão geral, que junta com `audit_logs` (só admin lê). A RPC confere
  `history.view_all` e devolve o nome de quem alterou.
- **Cifra colada, não importada:** nada busca conteúdo em sites; a pessoa cola o que tem direito
  de usar. Os testes usam só textos fictícios.
- **Identidade num arquivo:** `brand.ts` é lido também pelo `vite.config.ts`, por isso não
  importa nada do app.

### Erros encontrados pelo CI (e corrigidos)

1. Migration falhava num banco novo (FK de `role_permissions`): o catálogo de permissões só
   existia no seed. A migration ainda não tinha sido aplicada em lugar nenhum, então foi corrigida
   no próprio arquivo.
2. Testes antigos de API ("integrante não edita cifra/tom") passaram a editar de verdade e sujaram
   a música 1 do seed, derrubando outros testes. Foram trocados por verificações na música criada
   pela própria API.
3. Testes de tela contavam o link "Nova música" como música, e achavam nomes dentro de
   `<option>` de filtro. Ajustados os seletores.
4. Título "Ministério de Louvor · ADVOP" cortado no topo do celular: fonte menor no celular.

---

## Áudios: gravação de ensaio, referência e player com tom e velocidade (21/11/2026)

### Arquivos criados/alterados

- `supabase/migrations/20261123090000_audio.sql` (idempotente):
  - bucket privado `audios` (45 MB, só `audio/*`);
  - permissão `media.manage` (admin);
  - tabela `media_files` com GRANT, RLS e CHECKs (tipo/alvo, caminho, tamanho, `audio/*`);
  - policies de `storage.objects`;
  - `get_storage_usage()` (admin);
  - `audio_files_to_purge()` (só service_role).
- `supabase/functions/purge-old-recordings/`: limpeza diária pela API do Storage, protegida por
  `CRON_SECRET` (comparação em tempo constante); `?dry_run=1` só lista.
- `.github/workflows/purge-recordings.yml`: chamada diária (e manual, com dry run).
- `supabase/config.toml`: `verify_jwt = false` para a limpeza; `CRON_SECRET` do ambiente.
- `src/lib/audio/` (+ testes):
  - `format.ts`: formato por navegador;
  - `limits.ts`: 45 MB, avisos e formatação;
  - `semitones.ts`: diferença de tom pelo caminho mais curto;
  - `recording-store.ts`: IndexedDB;
  - `upload.ts`: envio com progresso;
  - `soundtouch.ts`: SoundTouch no AudioWorklet.
- `src/features/audio/`:
  - `api.ts`: listar com link assinado, enviar, apagar, espaço usado;
  - `use-recorder.ts`: gravador;
  - `audio-player.tsx`, `media-list.tsx`, `rehearsal-recordings.tsx`, `reference-audios.tsx`,
    `storage-usage-card.tsx`.
- Integração: detalhe do evento (ensaio), tela da música, Configurações.
- Testes:
  - `supabase/tests/media.test.sql` (22);
  - `e2e/wav.mjs` (áudio fictício gerado no teste);
  - verificações de API (Storage, limites, quem apaga, limpeza com e sem segredo);
  - fluxos de tela (enviar, tocar, velocidade, tom acompanhando a cifra, gravar, pausar,
    recarregar no meio, permissões, espaço).

### Decisões

- **Velocidade pelo `playbackRate` do `<audio>`, tom pelo SoundTouch** (recomendação da
  própria biblioteca): o arquivo toca em fluxo, sem decodificar tudo na memória — uma gravação de
  ensaio de 1 h viraria centenas de MB de PCM.
- **Licenças:** SoundTouchJS em AudioWorklet é MPL-2.0 (pode ser usada sem "contaminar" o resto
  do código). Rubber Band (GPL) foi descartado. O processador sai como arquivo separado no build.
- **Pedaços de 5 s no IndexedDB:** é o máximo que se perde se o app for morto. Gravar tudo só na
  memória perderia o ensaio inteiro.
- **Envio por XHR à API REST do Storage** (e não pelo supabase-js): é o jeito de ter barra de
  progresso. A permissão continua sendo a policy do bucket (token do usuário).
- **Apagar sempre pela API do Storage**, nunca `delete from storage.objects`: o Storage precisa
  saber, para liberar o espaço do arquivo de verdade.
- **Limpeza por Edge Function + GitHub Actions** (não pg_cron): quem apaga é a API do Storage, e o
  agendamento fica visível no GitHub. Segredo próprio, separado da service role.
- **"Arquivos órfãos"** (upload terminou, registro não) também são limpos depois de 1 dia.
- **service_role com GRANT explícito** em `media_files`: em projeto novo nem ela tem privilégio
  garantido em `public` (mesma lição do 403).
