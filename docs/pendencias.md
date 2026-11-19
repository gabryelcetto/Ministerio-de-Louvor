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

### 7. Comunicados e Integrantes sem atalho na barra inferior do celular

- **O quê:** a barra inferior tem 5 itens (Início, Escalas, Repertório, Agenda, Notificações). No
  celular, Comunicados e Integrantes só são acessíveis pelo endereço. Falta um menu "Mais".

### 8. Commit de merge sem linha de coautoria

- O commit `Merge branch 'feat/fase-b-banco' into feat/fase-c-cifras` (usado para levar a correção do
  teste pgTAP para a fase C sem reescrever histórico) saiu sem a linha `Co-authored-by`.

### 9. Telas da fase E sem teste com dados reais

- **O quê:** Dashboard, Minhas escalas, Detalhe do evento e Agenda foram construídos contra
  `src/types/database.types.ts` e as migrations, **sem banco disponível**. Foram validados com
  lint, typecheck, testes unitários das funções puras, build e capturas de tela com respostas
  simuladas da API (Playwright interceptando as chamadas ao Supabase).
- **O que não foi verificado com dados reais:**
  - formato real do JSON de `get_dashboard()` (ex.: `unread_notifications` vem como número;
    `next_service`/`next_rehearsal` como objeto `events` completo);
  - select aninhado do detalhe do evento (`events → event_assignments → profiles/ministry_functions`
    e `events → event_songs → songs`) — nomes das FKs em `Relationships` foram deduzidos do padrão
    do Postgres (`<tabela>_<coluna>_fkey`);
  - filtro no recurso embutido em Minhas escalas (`event:events!inner(...)` + `.gte('event.starts_at', …)`);
  - RLS de `profiles` para um integrante comum ver os nomes dos colegas da escala;
  - agrupamento por dia perto da meia-noite com eventos reais do seed.
- **O que fazer:** com o Supabase local no ar (`npx supabase db start` + `supabase/demo-users.sql`),
  entrar como líder e como integrante e abrir `/`, `/escalas`, `/escalas/<id>` e `/agenda`.
  Depois, gerar os tipos (pendência 5) e conferir se o typecheck continua passando.

### 10. Fase E incompleta: Comunicados, Integrantes, Repertório e Notificações

- **O quê:** a mensagem com o escopo da fase E chegou cortada depois do item "Agenda". Foram
  entregues Dashboard, Escalas (lista + detalhe) e Agenda. Continuam como tela provisória:
  Comunicados, Integrantes, Repertório (busca/filtro + `<ChordSheet>` com seletor de tom) e
  Notificações (lista + marcar como lida).
- **O que fazer:** confirmar o escopo restante e entregá-lo em um novo PR a partir da `main`.

### 11. `CLAUDE.md` recriado no repositório

- **O quê:** o `CLAUDE.md` citado nas instruções não estava versionado. Na fase E foi criado um
  com as regras atualizadas (fluxo de branches a partir da `main`, coautoria, fim da regra 5.1) e
  as convenções que aparecem no diário. Se existir uma versão local mais completa, junte as duas.

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

### 15. SQL do seed validado só pelo CI

- **O quê:** sem banco nesta execução, `supabase/seed.sql` e `supabase/demo-users.sql` não foram
  executados. O teste `seed.test.ts` confere o conteúdo das músicas, não a sintaxe SQL.
- **O que fazer:** o job `db` do CI aplica migrations + seed; para o `demo-users.sql`, rodar no
  SQL Editor depois de criar os 3 usuários e conferir que os perfis existem.

## Situação em 19/11/2026 (fase E)

- **Concluídas e na `main`:** fases A (fundação), B (banco), C (cifras) e D (login e layout).
- **Fase E (este PR):** Dashboard, Minhas escalas, Detalhe do evento e Agenda.
- **Falta da fase E:** ver pendência 10.
