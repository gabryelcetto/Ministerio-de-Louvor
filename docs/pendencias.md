# Pendências

Itens que dependem do dono do projeto ou que ficaram em aberto. Cada item diz **o quê**, **por quê** e
**o que fazer**.

## Abertas

### 32. Configurar o backup diário (repositório privado)

- **O quê:** o repositório privado `gabryelcetto/ministerio-louvor-ops` já tem o workflow
  `Backup do banco`, mas ele só funciona depois de cadastrar os secrets. Até lá, a execução
  agendada falha com "Falta o secret …" (de propósito: backup que não roda tem que avisar).
- **O que fazer:** seguir `ops/backup/README.md`: gerar o par de chaves `age` (a privada fica só
  com você, fora do GitHub), cadastrar `SUPABASE_DB_URL` (Session pooler) e `AGE_PUBLIC_KEY`,
  rodar uma vez pelo "Run workflow" e **testar uma restauração** num Supabase local.
- **Lembrete:** os áudios do Storage não entram no backup do banco.

### 2. Vitest falha no Windows quando a pasta é aberta como `c:\` (minúsculo)

- **O quê:** `npm test` acusa `Cannot read properties of undefined (reading 'config')`.
- **Por quê:** o VS Code abre o projeto como `c:\Minist-rio-de-Louvor`; o Node resolve o Vitest por dois
  caminhos (`c:` e `C:`) e carrega duas cópias. No CI (Linux) não acontece.
- **O que fazer:** rode os testes num terminal aberto em `C:\Minist-rio-de-Louvor` (C maiúsculo), ou abra
  a pasta no VS Code pelo caminho com `C:` maiúsculo.

### 3. Contas e chaves (só o dono pode criar)

- Projeto Supabase (plano Free), `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`,
  conta Cloudflare (Workers Free) conectada ao repositório. Passo a passo no PR mais recente.

### 6. Público dos comunicados (`audience`) ainda não filtra

- **O quê:** a coluna `audience` (`all|function|event|users`) existe, mas a policy hoje mostra todo
  comunicado publicado a todo integrante ativo. Falta a tabela de destinatários (ex.:
  `announcement_targets`) — fica para depois do protótipo.

### 8. Commit de merge sem linha de coautoria

- O commit `Merge branch 'feat/fase-b-banco' into feat/fase-c-cifras` (usado para levar a correção do
  teste pgTAP para a fase C sem reescrever histórico) saiu sem a linha `Co-authored-by`.

### 11. `CLAUDE.md` recriado no repositório

- **O quê:** o `CLAUDE.md` citado nas instruções não estava versionado. Na fase E foi criado um
  com as regras atualizadas (fluxo de branches a partir da `main`, coautoria, fim da regra 5.1) e
  as convenções que aparecem no diário. Se existir uma versão local mais completa, junte as duas.

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

### 17. Criar evento + equipe são duas gravações

- **O quê:** "Montar escala" com evento novo grava o evento e depois a equipe. Se a equipe
  falhar, o evento fica criado; a tela avisa ("O evento foi criado, mas a equipe não foi salva") e
  a nova tentativa grava só a equipe.
- **O que fazer (se incomodar):** uma RPC `create_event_with_team(...)` no banco faria tudo numa
  transação.

### 19. Instalação do app só testada em navegador simulado

- **O quê:** o botão "Instalar app" (Android/Chrome, via `beforeinstallprompt`), o passo a passo
  do iPhone e o aviso no Início foram conferidos no Chromium simulando Pixel e iPhone, com o
  evento de instalação **disparado à mão**. Não houve teste em aparelho de verdade.
- **O que fazer:** publicar (HTTPS é obrigatório para instalar) e conferir:
  - Android/Chrome: aviso no Início → "Instalar" abre a janela do Chrome; depois de instalado, o
    aviso some e Configurações mostra "App instalado neste aparelho";
  - iPhone/Safari: "Ver como instalar" → seguir os passos; abrir pelo ícone (tela cheia);
  - ícone e tela de abertura (fundo creme) no Android e no iPhone.

### 20. Ícone feito por script

- **O quê:** o ícone (colcheia azul-marinho com bandeirola dourada, fundo creme) é desenhado por
  `scripts/generate-icons.mjs`. É original e simples; se o ministério tiver um logo, trocar o
  desenho no script (ou os arquivos em `public/`).

### 21. Workflow "Deploy banco" ainda não executado

- **O quê:** `.github/workflows/deploy-db.yml` foi escrito e validado (YAML e sintaxe dos scripts),
  mas não rodou: depende do environment `staging` com os secrets/variable e de um projeto real.
- **Atenção à CLI do Supabase:** o workflow usa `supabase/setup-cli` com `version: latest`. A CLI
  v3 tornou os comandos de banco locais por padrão e exige confirmação para mexer no projeto
  hospedado; por isso os comandos usam `db push --linked --yes` e `SUPABASE_YES=true`. Não foi
  possível conferir na documentação oficial nesta execução (o site do Supabase não estava
  acessível daqui).
- **O que fazer:** configurar o `staging` (README), rodar uma vez **sem** seed e conferir o log da
  "Prévia (dry run)". Se algum flag for recusado, ajustar o comando conforme a mensagem da CLI.
  Depois de um deploy bem-sucedido, **fixar a versão** da CLI (`version: X.Y.Z` no lugar de
  `latest`) para o deploy não mudar sozinho.

### 22. Docker desta máquina danificado (disco cheio)

- **O quê:** em 20/11 o disco C: chegou a 0 bytes livres durante o download da imagem do Postgres
  do Supabase. O sistema de arquivos interno do Docker Desktop ficou com arquivos de 0 bytes
  (ex.: `docker-entrypoint.sh` da imagem `supabase/postgres`), e o `supabase start` não sobe
  mesmo baixando a imagem de novo. Por isso a validação com dados reais foi feita no runner do
  GitHub Actions (workflow **E2E (dados reais)**), que usa o mesmo Supabase local em Docker.
- **Já feito (autorizado):** `npm cache clean --force` e `docker image prune -a` (apagou as
  imagens paradas, inclusive `aluno-app`, `controle-equipamentos-docker-web`, `mysql:8.0`,
  `nginx` e `node:20-alpine`; os **volumes** do controle-equipamentos foram preservados).
- **O que fazer:** liberar espaço no C: (deixar 15 GB ou mais livres) e, no Docker Desktop,
  _Troubleshoot → Clean / Purge data_ (isso **apaga os volumes**, inclusive os do
  controle-equipamentos: faça backup antes) ou reinstalar o Docker Desktop. Depois,
  `npx supabase start` deve funcionar aqui também.

### 23. Fixar a versão da CLI também no "Deploy banco"

- **O quê:** os workflows CI e E2E passaram a usar `supabase/setup-cli` com `version: 3.2.0`
  (com `latest`, o job `db` falhou uma vez por limite de requisições da API do GitHub). O
  `deploy-db.yml` continua com `latest` (ver pendência 21).
- **O que fazer:** depois do primeiro deploy bem-sucedido, trocar para `version: 3.2.0`.

### 24. `npm run format:check` falha no Windows por fim de linha

- **O quê:** com `core.autocrlf=true`, o Git entrega os arquivos com CRLF e o Prettier (que
  espera LF) acusa uns 80 arquivos. No Git e no CI os arquivos estão em LF e formatados
  (conferido convertendo os arquivos alterados para LF).
- **O que fazer (opcional):** adicionar `.gitattributes` com `* text=auto eol=lf` e rodar
  `git add --renormalize .`, ou `git config core.autocrlf input` nesta máquina.

### 25. Partes do roteiro que continuam manuais

- Rede lenta/offline (estados "Carregando…" e "Tentar de novo"), comunicado agendado no futuro,
  inativar integrante pelo SQL Editor, Safari do iPhone e instalação do app (pendência 19). O
  resto de `docs/roteiro-de-teste.md` roda no workflow **E2E (dados reais)**.

### 26. "Workers Builds" da Cloudflare falha em branches de PR

- **O quê:** a integração da Cloudflare com o GitHub (conectada depois do PR #9) passou na `main`,
  mas falha no PR "fix: validação com dados reais" desde o 1º commit, que só adicionou `e2e/` e
  um workflow. Localmente, `npm run build` e `npx wrangler deploy --dry-run` passam (13 arquivos
  de `dist/`, sem erro). O log fica no painel da Cloudflare, que exige login.
- **Provável causa:** configuração de builds de branches **não-produção** (comando de deploy
  dessas branches, normalmente `npx wrangler versions upload`, ou variáveis `VITE_*` definidas só
  para produção).
- **O que fazer:** abrir o link "Details" do check "Workers Builds" no PR e ler o log. Em
  _Workers & Pages → ministerio-de-louvor → Settings → Build_, conferir "Non-production branch
  deploy command" e se as variáveis de build valem para todas as branches (ou desligar builds de
  branches não-produção, se não quiser prévias).

### 27. Endurecer privilégios das tabelas só de inserção (opcional)

- **O quê:** `song_versions` (gravada só por trigger) e `audit_logs` (só inserção) recebem
  `update/delete` para `authenticated` como as demais; quem impede alterar é o RLS (sem policy).
  Tirar o GRANT seria uma segunda barreira, mas muda a regra "S/I/U/D em todas as tabelas".
- **O que fazer (se quiser):** migration com
  `revoke update, delete on public.song_versions, public.audit_logs from authenticated;` (e
  `insert` em `song_versions`) e ajustar o `privileges.test.sql`.

### 28. Aplicar a migration de GRANT na nuvem

- **O quê:** `20261120200000_explicit_grants.sql` ainda não foi aplicada pelo workflow; a nuvem
  está com a correção manual. A migration é idempotente (o CI prova: aplica um `grant all`,
  reaplica a migration duas vezes e roda o pgTAP).
- **O que fazer:** depois do merge, Actions → **Deploy banco** → Run workflow (sem seed). Conferir
  na prévia que só esta migration aparece. Depois, no SQL Editor da nuvem, a consulta abaixo deve
  mostrar `DELETE, INSERT, SELECT, UPDATE` para `authenticated` em cada tabela (exceto
  `profiles`, sem linha de tabela, e `notifications`, só `SELECT`) e **nenhuma** linha de
  `anon`:

  ```sql
  select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type)
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated')
  group by 1, 2
  order by 1, 2;
  ```

### 29. Publicar o cadastro de integrantes na nuvem

- **O quê:** migration `20261121090000_member_onboarding.sql`, Edge Function `invite-member` e
  regra de senha do Auth ainda não estão no projeto da nuvem.
- **O que fazer:** os comandos estão no PR "cadastro de integrantes" e no README (seção
  "Cadastrar integrantes"). A regra de senha (10 caracteres, letras e números) é configurada no
  painel do Auth.

### 30. `complete_password_change()` não confere se a senha mudou de fato

- **O quê:** o app troca a senha no Auth e depois chama a RPC. Alguém que chamasse só a RPC pelo
  console liberaria a própria conta mantendo a senha provisória, que quem cadastrou conhece.
  Só a própria pessoa consegue fazer isso.
- **O que fazer (se quiser fechar):** fazer a troca numa Edge Function (`change-password`), que
  chama `auth.admin.updateUserById` e limpa a flag na mesma operação.

### 31. Senha provisória sem validade e sem "esqueci minha senha"

- **O quê:** a senha provisória não expira. Também não há recuperação de senha por e-mail: isso
  depende de SMTP, que ficou fora do protótipo.
- **O que fazer:** depois do protótipo, (a) expirar contas com `must_change_password` que não
  entraram em X dias; (b) uma ação "Gerar nova senha provisória" para `members.manage`, que pode
  reaproveitar a Edge Function.

### 33. Publicar a base ADVOP na nuvem

- **O quê:** migration `20261122090000_advop_roles_songs.sql` (perfis, permissões, músicas,
  atividade), nova versão da Edge Function `invite-member` (sem "liderança") e o app.
- **O que fazer:** comandos no PR "base ADVOP". Depois da migration, conferir em Integrantes que
  ninguém ficou como "Liderança" e que as funções vocais aparecem como "Cantor(a)".
- **Atenção:** quem era líder perde montar escala, comunicados, contatos e restaurar (agora só
  admin). Se alguém precisar continuar, dê a exceção individual (`user_permissions`, `grant`).

### 34. Funções novas do ministério nascem "instrumental"

- **O quê:** `ministry_functions.section` tem padrão `instrumental`; uma função vocal criada
  depois (ex.: "Ministro(a)") precisa ter `section = 'vocal'` ajustado no SQL Editor (ainda não há
  tela de funções).

### 35. Detecção de tom é uma sugestão

- **O quê:** o tom sugerido na "Nova música" vem do campo harmônico e do primeiro/último acorde.
  Músicas modais ou com muitas modulações podem sugerir o tom relativo (ex.: Em no lugar de G).
  A pessoa confirma ou troca antes de salvar.

### 36. Publicar os áudios na nuvem

- **O quê:** migration `20261123090000_audio.sql` (bucket, `media_files`, policies), Edge Function
  `purge-old-recordings`, segredo `CRON_SECRET` (na função e no environment `staging` do
  GitHub) e a variable `SUPABASE_URL`.
- **O que fazer:** comandos no PR de áudio e no README ("Publicar a limpeza automática").

### 37. Testar a gravação em aparelhos de verdade

- **O quê:** o E2E grava com o microfone falso do Chromium. Falta conferir no **iPhone/Safari**
  (AAC, Wake Lock a partir do iOS 16.4, gravação com a tela bloqueada) e num Android barato
  (consumo de bateria numa gravação de 1–2 h).
- **Atenção:** no iPhone a gravação para se a tela bloquear ou o app for para o fundo; os pedaços
  gravados até ali ficam salvos e aparecem como "não enviada".

### 38. Arquivos do Storage fora do backup

- **O quê:** o backup diário (PR "ops/backup") leva só o banco. Os áudios de referência (que não
  expiram) precisam de cópia à parte se forem importantes: baixar pelo painel (Storage → audios).

### 39. Disco do Docker nesta máquina

- **O quê:** `docker_data.vhdx` (~9 GB) não encolhe sozinho depois que as imagens são apagadas.
  Para recuperar o espaço no C:, compactar o disco virtual do Docker Desktop (como administrador)
  ou usar _Troubleshoot → Clean / Purge data_ (apaga também os volumes de outros projetos).

## Resolvidas recentemente

- **Cadastro de integrantes** — Edge Function `invite-member`, tela, primeiro acesso e
  "Trocar senha" (PR "cadastro de integrantes").

- **403 em quase tudo no projeto da nuvem** — migration
  `20261120200000_explicit_grants.sql`; CI e E2E agora simulam a nuvem e testam os privilégios
  (ver diário).

- **4. pgTAP sem rodar com banco** — rodam no job `db` do CI e no workflow E2E; todos passam.
- **5. Tipos escritos à mão** — `src/types/database.types.ts` agora é o gerado pelo Supabase
  (idêntico ao gerado no CI); tipos de domínio em `src/types/app.types.ts`.
- **9. Telas da fase E sem dados reais** — 84/84 telas (3 perfis × celular/desktop) sem erro de
  API, de console ou rolagem lateral; FKs, `get_dashboard`, busca sem acento, `read_at`,
  contagem de não lidas, `get_member_contacts` e RLS de `profiles` conferidos.
- **15. demo-users.sql não executado** — roda a cada execução do E2E (perfis, funções e escalas).
- **16. Fase F sem dados reais** — editar letra/cifra/tom oficial, histórico com restauração,
  montar escala e notificações conferidos (29/29 passos), além das recusas do banco chamando a
  API direto (12/12).

- **7. Comunicados e Integrantes sem atalho no celular** — menu "Mais" na barra inferior.
- **10. Fase E incompleta** — Repertório, Notificações, Comunicados e Integrantes entregues.
- **12. Grafia do baixo na transposição** — fase F: cada nota (tônica e baixo) é escrita pelo
  grau no tom de destino; `A/G` de E para G sai `C/Bb`.
- **18. Configurações provisória** — tela de Configurações com perfil, tema, instalar e sair.

## Situação em 21/11/2026

- **Na `main`:** fases A a F, CI/E2E com simulação da nuvem, GRANT explícito, tipos gerados.
- **PR "cadastro de integrantes" (aberto, sem merge):** Edge Function `invite-member`, primeiro
  acesso com troca obrigatória de senha, "Trocar senha" em Configurações.
