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

### 12. Transposição: grafia do baixo segue o tom de destino

- **O quê:** a biblioteca da fase C escolhe sustenido ou bemol pelo tom de destino. Em linhas de
  baixo descendente isso pode sair com a grafia menos natural: `A/G` em E transposto para G vira
  `C/A#` (o músico escreveria `C/Bb`). O som está certo; só a grafia.
- **O que fazer (opcional):** em `src/lib/chords/chord.ts`, escolher a grafia do baixo pela
  direção do movimento ou por uma tabela de baixos comuns por tom. Tem teste para acrescentar em
  `chords.test.ts`.

### 13. Listas com limite fixo

- **O quê:** Notificações mostra as 100 mais recentes e Comunicados os 50 mais recentes (com
  aviso na tela quando o limite é atingido). Não há paginação ("carregar mais").
- **O que fazer:** quando o volume justificar, trocar por `useInfiniteQuery` com `range()`.

### 14. Conferir o texto dos hinos do seed com um hinário impresso antigo

- **O quê:** o seed traz a 1ª estrofe de 4 hinos em português de domínio público: "Santo! Santo!
  Santo!" e "Mais Perto Quero Estar" (trad. João Gomes da Rocha, 1861–1947), "Sou Feliz com
  Jesus" (trad. W. E. Entzminger, 1859–1930) e "Doxologia" (trad. Sarah P. Kalley, 1825–1907).
  As **autorias** foram conferidas no hymnary.org; o **texto** foi escrito na forma tradicional
  do Cantor Cristão, mas não foi possível conferir palavra por palavra (os sites de busca não
  reproduzem letras).
- **Por quê:** hinários recentes trazem versões revisadas ("alt."), e a revisão pode ter direitos
  próprios. Vale a versão antiga.
- **O que fazer:** comparar com uma edição anterior a 1956 (ex.: Cantor Cristão ou Salmos e
  Hinos antigos). Se alguma diferir de forma relevante ou houver dúvida, trocar o texto por um
  fictício marcado "(exemplo)" — o teste `src/lib/chords/seed.test.ts` garante que letra, cifra
  e tom continuam consistentes.
- **Fora do seed:** "Castelo Forte" (trad. J. Eduardo von Hafe, 1886) ficou de fora porque não
  foi possível confirmar a data de falecimento do tradutor.

### 15. `demo-users.sql` ainda não executado

- **O quê:** o `seed.sql` novo já rodou no job `db` do CI (migrations + seed + pgTAP verdes no
  PR #6). O `supabase/demo-users.sql` não roda no CI (depende de usuários criados no painel), então
  o novo `insert` de perfis não foi executado.
- **O que fazer:** rodar no SQL Editor depois de criar os 3 usuários e conferir que os perfis
  existem com os nomes e papéis do script.

## Resolvidas recentemente

- **7. Comunicados e Integrantes sem atalho no celular** — menu "Mais" na barra inferior.
- **10. Fase E incompleta** — Repertório, Notificações, Comunicados e Integrantes entregues.

## Situação em 19/11/2026 (fase E concluída)

- **Na `main`:** fases A (fundação), B (banco), C (cifras), D (login e layout) e a primeira parte
  da E (Início, Escalas, Agenda).
- **Este PR:** Repertório (lista + música com cifra transponível), Notificações, Comunicados,
  Integrantes e menu "Mais" — fecha a fase E.
- **Próximo:** fase F (não iniciada).
