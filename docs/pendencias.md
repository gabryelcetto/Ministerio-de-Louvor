# Pendências

Itens que dependem do dono do projeto ou que ficaram em aberto. Cada item diz **o quê**, **por quê** e
**o que fazer**.

## Abertas

### 2. Vitest falha no Windows quando a pasta é aberta como `c:\` (minúsculo)

- **O quê:** `npm test` acusa `Cannot read properties of undefined (reading 'config')`.
- **Por quê:** o VS Code abre o projeto como `c:\Minist-rio-de-Louvor`; o Node resolve o Vitest por dois
  caminhos (`c:` e `C:`) e carrega duas cópias. No CI (Linux) não acontece.
- **O que fazer:** rode os testes num terminal aberto em `C:\Minist-rio-de-Louvor` (C maiúsculo), ou abra
  a pasta no VS Code pelo caminho com `C:` maiúsculo.

### 3. Contas e chaves (só o dono pode criar)

- Projeto Supabase (plano Free), `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`,
  conta Cloudflare (Workers Free) conectada ao repositório. Passo a passo no PR mais recente.

### 4. Testes pgTAP ainda não rodaram localmente

- **O quê:** o Docker Desktop não estava rodando nesta máquina, então `supabase test db` não foi
  executado aqui. A validação fica com o job `db` do CI (roda em todo PR).
- **O que fazer:** abrir o Docker Desktop e rodar `npx supabase db start` e `npx supabase test db`.
  Se o CI acusar falha, o log do job `db` mostra qual teste quebrou.

### 5. `src/types/database.types.ts` escrito à mão

- **Por quê:** sem Docker não dá para rodar `supabase gen types typescript --local`.
- **O que fazer:** com o Supabase local no ar, rode
  `npx supabase gen types typescript --local > src/types/database.types.ts` e confira o typecheck.

### 6. Público dos comunicados (`audience`) ainda não filtra

- **O quê:** a coluna `audience` (`all|function|event|users`) existe, mas a policy hoje mostra todo
  comunicado publicado a todo integrante ativo. Falta a tabela de destinatários (ex.:
  `announcement_targets`) — fica para depois do protótipo.

### 8. Commit de merge sem linha de coautoria

- O commit `Merge branch 'feat/fase-b-banco' into feat/fase-c-cifras` (usado para levar a correção do
  teste pgTAP para a fase C sem reescrever histórico) saiu sem a linha `Co-authored-by`.

### 9. Telas da fase E sem teste com dados reais

- **O quê:** todas as telas de leitura (Início, Minhas escalas, Detalhe do evento, Agenda,
  Repertório, Música, Notificações, Comunicados, Integrantes e o menu "Mais") foram construídas
  contra `src/types/database.types.ts` e as migrations, **sem banco disponível**. Foram validadas
  com lint, typecheck, testes unitários das funções puras, build e capturas de tela com respostas
  simuladas da API (Playwright interceptando as chamadas ao Supabase), nos papéis de integrante e
  de admin.
- **O que não foi verificado com dados reais:**
  - formato real do JSON de `get_dashboard()` (ex.: `unread_notifications` como número;
    `next_service`/`next_rehearsal` como objeto `events` completo);
  - selects aninhados — os nomes das FKs em `Relationships` foram deduzidos do padrão do Postgres
    (`<tabela>_<coluna>_fkey`): `events → event_assignments → profiles/ministry_functions`,
    `events → event_songs → songs`, `songs → song_lyrics/song_chords` (1-para-1, vêm como objeto),
    `profiles → member_functions → ministry_functions` e `announcements → profiles` (autor);
  - filtro no recurso embutido em Minhas escalas (`event:events!inner(...)` + `.gte('event.starts_at', …)`);
  - `search_songs` encadeado com `.select(...)` e `.eq('category', …)` (filtro sobre o resultado
    da função) e a busca sem acento com os títulos reais;
  - `update` de `notifications.read_at` com o GRANT de coluna (deve funcionar só para as próprias);
  - contagem de não lidas com `head: true` + `count: 'exact'` (o Supabase devolve no `Content-Range`);
  - `get_member_contacts` para líder/admin (todos) e o fato de o integrante **não** chamar a RPC;
  - RLS de `profiles` para um integrante comum ver os nomes dos colegas;
  - agrupamento por dia perto da meia-noite com eventos reais do seed;
  - o `<dialog>` do menu "Mais" no Safari do iPhone (testado só no Chromium).
- **O que fazer:** seguir `docs/roteiro-de-teste.md` com os usuários de `supabase/demo-users.sql`.
  Depois, gerar os tipos (pendência 5) e conferir se o typecheck continua passando.

### 11. `CLAUDE.md` recriado no repositório

- **O quê:** o `CLAUDE.md` citado nas instruções não estava versionado. Na fase E foi criado um
  com as regras atualizadas (fluxo de branches a partir da `main`, coautoria, fim da regra 5.1) e
  as convenções que aparecem no diário. Se existir uma versão local mais completa, junte as duas.

### 13. Listas com limite fixo

- **O quê:** Notificações mostra as 100 mais recentes e Comunicados os 50 mais recentes (com
  aviso na tela quando o limite é atingido). Não há paginação ("carregar mais").
- **O que fazer:** quando o volume justificar, trocar por `useInfiniteQuery` com `range()`.

### 16. Fase F sem teste com dados reais

- **O quê:** edição de letra/cifra/tom oficial, histórico com restauração e montar escala foram
  validados com testes unitários e no navegador com a API simulada (inclusive respostas de recusa
  do banco), **sem banco**.
- **O que não foi verificado com dados reais:**
  - `upsert` em `song_lyrics`/`song_chords` (`on conflict (song_id)`): para quem **não** tem
    `chords.edit_official`, o esperado é erro 42501 do PostgREST no `ON CONFLICT DO UPDATE`;
  - `update … select('id')` barrado pelo RLS devolvendo **0 linhas** (o app mostra "Nada foi
    salvo…");
  - o trigger `guard_song_official_key` respondendo 42501 com a mensagem em português;
  - `restore_song_version` para cada campo (letra, cifra, tom oficial, dados) e o registro da
    restauração como nova versão;
  - FK `song_versions.changed_by → profiles` no select do histórico (nome deduzido do padrão);
  - `insert` em `events` com `select('id')` (exige a policy de leitura, que integrantes ativos têm)
    e as notificações geradas ao incluir/remover pessoas.
- **O que fazer:** seguir a seção "Fase F" de `docs/roteiro-de-teste.md` com os 3 usuários demo.

### 17. Criar evento + equipe são duas gravações

- **O quê:** "Montar escala" com evento novo grava o evento e depois a equipe. Se a equipe
  falhar, o evento fica criado; a tela avisa ("O evento foi criado, mas a equipe não foi salva") e
  a nova tentativa grava só a equipe.
- **O que fazer (se incomodar):** uma RPC `create_event_with_team(...)` no banco faria tudo numa
  transação.

### 18. Configurações ainda é tela provisória

- **O quê:** a tela de Configurações (perfis, permissões, funções do ministério) não foi pedida
  até a fase F.

## Resolvidas recentemente

- **7. Comunicados e Integrantes sem atalho no celular** — menu "Mais" na barra inferior.
- **10. Fase E incompleta** — Repertório, Notificações, Comunicados e Integrantes entregues.
- **12. Grafia do baixo na transposição** — fase F: cada nota (tônica e baixo) é escrita pelo
  grau no tom de destino; `A/G` de E para G sai `C/Bb`.

## Situação em 19/11/2026 (fase F)

- **Na `main`:** fases A a E.
- **Fase F (este PR):** editar letra, cifra (com pré-visualização) e tom oficial; histórico com
  restauração; erros do banco em português (`src/lib/errors.ts`); grafia do baixo (pendência 12);
  montar escala (evento + pessoas + funções).
