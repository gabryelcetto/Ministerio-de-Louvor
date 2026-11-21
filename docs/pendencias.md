# Pendências

Itens que dependem do dono do projeto ou que ficaram em aberto. Cada item diz **o quê**, **por quê** e
**o que fazer**.

## Abertas

### 32. Configurar o backup diário (repositório privado)

- **O quê:** o repositório privado `gabryelcetto/ministerio-louvor-ops` já tem o workflow
  `Backup do banco`. Em 21/11/2026 o par de chaves `age` foi gerado nesta máquina (a privada
  ficou em `Documentos\louvor-backup\`, fora do repositório) e o secret `AGE_PUBLIC_KEY` foi
  cadastrado. **Falta o `SUPABASE_DB_URL`**, que tem a senha do banco e por isso fica com o dono.
  Até lá, a execução agendada falha com "Falta o secret …" (de propósito).
- **O que fazer:** cadastrar `SUPABASE_DB_URL` (Session pooler), rodar uma vez pelo
  "Run workflow" e **testar uma restauração** num Supabase local (`ops/backup/README.md`).
  Guarde uma cópia da chave privada `age` fora deste computador (pendrive ou gerenciador de
  senhas): sem ela o backup não abre.
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

### 28. Conferir os privilégios na nuvem

- **O quê:** `20261120200000_explicit_grants.sql` foi aplicada na nuvem em 21/11/2026 (`db push`,
  junto com as demais). Falta só a conferência visual.
- **O que fazer:** no SQL Editor da nuvem, a consulta abaixo deve
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

### 30. `complete_password_change()` não confere se a senha mudou de fato

- **O quê:** o app troca a senha no Auth e depois chama a RPC. Alguém que chamasse só a RPC pelo
  console liberaria a própria conta mantendo a senha provisória, que quem cadastrou conhece.
  Só a própria pessoa consegue fazer isso.
- **O que fazer (se quiser fechar):** fazer a troca numa Edge Function (`change-password`), que
  chama `auth.admin.updateUserById` e limpa a flag na mesma operação.

### 31. Senha provisória sem validade e sem "esqueci minha senha"

- **O quê:** a senha provisória não expira. Também não há recuperação de senha por e-mail: isso
  depende de SMTP, que ficou fora do protótipo.
- **O que fazer:** depois do protótipo, expirar contas com `must_change_password` que não
  entraram em X dias. (A ação "Redefinir senha" para o admin já existe: PR "admin redefine senha
  de integrante".)

### 35. Detecção de tom é uma sugestão

- **O quê:** o tom sugerido na "Nova música" vem do campo harmônico e do primeiro/último acorde.
  Músicas modais ou com muitas modulações podem sugerir o tom relativo (ex.: Em no lugar de G).
  A pessoa confirma ou troca antes de salvar.

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

### 40. Publicar a redefinição de senha na nuvem

- **O quê:** migration `20261124090000_member_password_reset.sql` (RPCs da redefinição e grupo
  obrigatório nas funções) e Edge Function `reset-member-password`.
- **O que fazer (depois do merge do PR):** `npx supabase db push --dry-run` (só essa migration),
  `npx supabase db push` e `npx supabase functions deploy reset-member-password --use-api`
  (README, "Redefinir a senha de um integrante").
- **Sem teste com dados reais nesta máquina** (sem Docker, disco cheio): pgTAP e E2E rodam no CI.

### 41. Sessões abertas continuam com o token antigo após a redefinição

- **O quê:** redefinir a senha não derruba os aparelhos em que a pessoa já estava logada; o
  token antigo vale até expirar. Não é brecha: com `must_change_password = true` o banco não
  deixa essa sessão ler nem alterar nada, e o app mostra "Defina sua senha".
- **O que fazer (se quiser):** na Edge Function, depois de trocar a senha, encerrar as sessões
  da pessoa (apagar as linhas dela em `auth.sessions` por uma RPC só para `service_role`).

### 42. Publicar "gravar na música" na nuvem (o dono roda)

- **O quê:** migration `20261125090000_audio_labels_limits.sql` (nome do áudio, limite de 3
  referências por música, bloqueio a 90% de 1 GB). O app já sai pelo deploy da Cloudflare, mas
  **gravar na música só funciona de verdade depois da migration**: sem ela, o envio falha porque
  a RPC `check_audio_upload` ainda não existe.
- **Por que não foi feito:** a senha do banco mudou; o `db push` fica com o dono.
- **O que fazer:**

  ```bash
  npx supabase db push --dry-run   # deve listar 20261125090000_audio_labels_limits.sql
  npx supabase db push             # (e 20261124090000, se ainda não foi aplicada)
  ```

### 43. Bloqueio de 90% conta o bucket inteiro

- **O quê:** o uso vem da soma do tamanho dos arquivos do bucket `audios` (o mesmo número de
  Configurações). Arquivos "órfãos" (upload sem registro) contam até a limpeza diária apagá-los.
- **Atenção:** o banco não sabe o tamanho do arquivo **antes** do envio; quem está em 89% ainda
  consegue enviar um arquivo de até 45 MB, passando um pouco de 90%. O limite de 1 GB do plano
  continua longe.

### 44. Duplo clique em "Salvar letra" grava duas vezes (Chromium) — QA, médio

- **O quê:** no Chromium, um duplo clique rápido em "Salvar letra" manda duas gravações antes
  de o botão virar "Salvando…" (WebKit e Firefox mandam uma). O resultado final é o mesmo
  texto, mas o histórico ganha uma versão repetida.
- **O que fazer:** ignorar o segundo envio enquanto o primeiro está em andamento (checar
  `save.isPending` no `onSubmit` ou guardar uma trava num ref). Vale para todos os editores.
- Relatório: `docs/qa/relatorio-qa-2026-11-21.md`.

### 45. Sem internet ao salvar, a mensagem de conexão demora — QA, médio

- **O quê:** com o aparelho offline, "Salvar letra" fica em "Salvando…" e não mostrou "Sem
  conexão com o servidor…" em 15 s (o texto digitado continua no campo, nada se perde). A biblioteca não repete
  gravações (só GET/HEAD), então a espera vem de outro ponto (provavelmente a sessão do Auth).
- **O que fazer:** pôr um tempo limite nas gravações (ex.: `AbortSignal.timeout(15000)` no
  cliente) para a pessoa ver o erro e poder tentar de novo; investigar com o navegador aberto.

### 46. Envio de áudio sem internet fica parado em "Enviando… 0%" — QA, médio

- **O quê:** sem internet, o envio de uma gravação ficou mais de 20 s em "Enviando… 0%", com
  "Enviar" e "Descartar" desativados. A gravação continua salva no aparelho.
- **O que fazer:** tempo limite também na consulta `check_audio_upload` e no envio (o XHR já
  aceita `signal`), mais um botão "Cancelar envio".

### 47. Mensagens específicas do envio de áudio não chegam à tela — Vitest, médio

- **O quê:** `uploadErrorMessage()` monta mensagens claras ("Sem conexão…", "O arquivo passou
  do limite de 45 MB", "Você não tem permissão…"), mas o `UploadError` não é
  `UserFacingError`; o `friendlyError` mostra o texto genérico "Não foi possível enviar o
  áudio".
- **O que fazer:** `UploadError extends UserFacingError` (os dois ficam em `src/lib`) e ajustar
  o teste em `reference-audios.test.tsx`.

### 48. Mutantes sobreviventes nos módulos com score mais baixo — baixo

- **O quê:** score geral de 78,95% (alto 85, baixo 70, quebra 65). Os menores:
  `src/lib/audio/format.ts` (61%), `src/lib/errors.ts` (66%), `src/lib/chords/paste.ts` (67%),
  `src/lib/chords/convert.ts` (68%), `src/lib/password.ts` (69%).
- **O que fazer:** abrir o artefato **mutacao** (relatório HTML) e escrever testes que matem os
  sobreviventes relevantes até passar de 85%.

### 49. Testes de tela: `isDirty` do react-hook-form no happy-dom

- **O quê:** no happy-dom, o `isDirty` não muda ao digitar; o teste de "Editar dados" envia o
  formulário direto (`fireEvent.submit`). No navegador o botão funciona (coberto pelo E2E).

## Resolvidas recentemente

- **34. Funções novas do ministério nasciam "instrumental"** — tela **Integrantes → Funções do
  ministério**: o grupo (Cantores/Instrumentistas) é obrigatório ao cadastrar e pode ser trocado
  na lista; o banco não tem mais valor padrão (PR "admin redefine senha de integrante").
- **29, 33 e 36. Publicar cadastro, base ADVOP e áudios na nuvem** — feito em 21/11/2026:
  `db push` das migrations até `20261123090000_audio.sql`, Edge Functions `invite-member` e
  `purge-old-recordings` publicadas, `CRON_SECRET` configurado (função e environment `staging`),
  limpeza testada em dry run. Conferir no painel do Auth a regra de senha (10 caracteres, letras e
  números), se ainda não estiver.

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

## Situação em 21/11/2026 (tarde)

- **PR "teste estrutural, mutação e QA":** cobertura com limites (projeto 95% de linhas),
  arquitetura (dependency-cruiser), mutação (Stryker, score inicial 78,95%) e QA em 3
  navegadores × 4 tamanhos; 4 correções altas; médios nas pendências 44 a 47.

## Situação em 21/11/2026 (dia)

- **PR "gravar na música":** gravação direto na tela da música (componente de gravação comum ao
  ensaio), nome do áudio, limite de 3 referências por música e bloqueio a 90% do espaço. Falta o
  `db push` (pendência 42).

## Situação em 21/11/2026 (noite)

- **Na `main`:** fases A a F, CI/E2E com simulação da nuvem, GRANT explícito, cadastro de
  integrantes, base ADVOP, backup (scripts) e áudios. Tag `v0.2.0`.
- **Na nuvem:** todas as migrations até `20261123090000_audio.sql`, Edge Functions `invite-member`
  e `purge-old-recordings`, `CRON_SECRET` configurado.
- **PR "admin redefine senha de integrante" (aberto, sem merge):** Edge Function
  `reset-member-password`, botão em Integrantes, tela de funções do ministério (pendência 34).
