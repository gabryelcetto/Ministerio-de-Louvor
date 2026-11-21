# Resumo da noite de 20 para 21/11/2026

Trabalho autônomo nas quatro tarefas deixadas pelo dono. Nenhum segredo (senha do banco,
`CRON_SECRET`, chave privada `age`, tokens) foi impresso, gravado em arquivo do repositório ou
mostrado em log.

## Tarefa 1 — Áudio na `main`

- PR [#16](https://github.com/gabryelcetto/Ministerio-de-Louvor/pull/16) (`feat/audio` → `main`),
  com a `main` trazida para a branch e os conflitos resolvidos.
- Conferido na `main`:
  - `supabase/migrations/20261123090000_audio.sql`;
  - `supabase/functions/purge-old-recordings/`;
  - `.github/workflows/purge-recordings.yml`.
- CI 100% verde antes do merge. Merge com **merge commit** `f427827`; a branch não foi apagada.
- Depois do merge, na `main`:
  - CI verde: "Lint, tipos, testes e build" e "Banco (migrations + pgTAP)";
  - deploy da Cloudflare verde (Workers Builds).

## Tarefa 2 — Publicação na nuvem

- `db push --dry-run`: só migrations a partir de 20261120. Depois, `db push` **sem seed**. As
  migrations da nuvem estão em dia até `20261123090000_audio.sql`.
- Edge Functions publicadas:
  - `invite-member`;
  - `purge-old-recordings` (`--no-verify-jwt`).
- `CRON_SECRET` gerado localmente sem ser impresso e cadastrado em três lugares:
  - nos secrets das funções;
  - no environment `staging` do GitHub (o environment não existia e foi criado);
  - variable `SUPABASE_URL` no mesmo environment.
- "Limpeza de gravações antigas" em dry run:
  [execução 44855231600](https://github.com/gabryelcetto/Ministerio-de-Louvor/actions/runs/44855231600),
  verde.
- Teste de fumaça anônimo: todas as tabelas, RPCs, o bucket e as funções recusam quem não está
  logado.
- Tag e release
  [v0.2.0](https://github.com/gabryelcetto/Ministerio-de-Louvor/releases/tag/v0.2.0).

## Tarefa 3 — Chave do backup (`age`)

- `age` instalado pelo winget.
- O par de chaves foi gerado em `Documentos\louvor-backup\louvor-backup-chave-privada.txt`, fora
  do repositório. A chave privada não foi mostrada em nenhum momento.
- Só o secret `AGE_PUBLIC_KEY` foi cadastrado no repositório privado
  `gabryelcetto/ministerio-louvor-ops`.
- **`SUPABASE_DB_URL` não foi cadastrado, de propósito:** ele tem a senha do banco. Os passos
  estão logo abaixo, em "De manhã".

## Tarefa 4 — Admin redefine senha de integrante

- PR [#17](https://github.com/gabryelcetto/Ministerio-de-Louvor/pull/17), **aberto e sem merge**
  (aguarda revisão).
- Edge Function `reset-member-password`:
  - regras no banco: `members.manage`; a senha do dono ninguém redefine; a de outro admin, só o
    dono; a própria senha é em Configurações;
  - senha provisória forte gerada no servidor e devolvida uma vez (`no-store`);
  - troca obrigatória de senha no próximo acesso;
  - registro em `audit_logs`.
- Botão **Redefinir senha** em Integrantes, com confirmação, senha provisória e mensagem pronta
  para o WhatsApp (igual ao cadastro).
- Pendência 34: tela **Funções do ministério**. O grupo (Cantores/Instrumentistas) é obrigatório
  ao cadastrar e pode ser trocado na lista.
- Testes: pgTAP (17), Vitest, E2E de API e E2E de tela. Os testes com banco rodam no CI.
- Depois do merge, publicar na nuvem (pendência 40): `db push` da migration
  `20261124090000_member_password_reset.sql` e
  `functions deploy reset-member-password --use-api`.

## O que ficou pendente e por quê

- **`SUPABASE_DB_URL` no repositório de backup:** tem a senha do banco, então fica com o dono.
  Até lá, o "Backup do banco" agendado falha com "Falta o secret …", de propósito.
- **PR #17 sem merge:** pedido do dono.
- **Redefinição de senha não publicada na nuvem:** depende do merge do #17.
- **Nada testado com banco nesta máquina:** o disco C: está quase cheio (cerca de 3 GB livres),
  então não houve Docker nem `supabase start`. Todo teste com banco rodou no GitHub Actions.

## De manhã: o que o dono faz

### 1. Cadastrar `SUPABASE_DB_URL` no repositório de backup

1. No painel do Supabase: **Connect → Session pooler**. Copie a URI e troque `[YOUR-PASSWORD]`
   pela senha do banco.
2. No terminal (o `gh` pede o valor e não o mostra):

   ```bash
   gh secret set SUPABASE_DB_URL --repo gabryelcetto/ministerio-louvor-ops
   ```

### 2. Rodar o backup uma vez

```bash
gh workflow run "Backup do banco" --repo gabryelcetto/ministerio-louvor-ops
gh run list --repo gabryelcetto/ministerio-louvor-ops --limit 1
```

- Baixe o artefato e teste uma restauração seguindo `ops/backup/README.md`: decifrar com a chave
  privada e restaurar num Supabase local.
- **Guarde uma cópia da chave privada fora deste computador**, num pendrive ou num gerenciador de
  senhas. Sem ela, o backup não abre.

### 3. Revisar o PR #17 e publicar

Se aprovar, faça o merge com **"Create a merge commit"** e depois rode:

```bash
npx supabase db push --dry-run   # deve listar só 20261124090000_member_password_reset.sql
npx supabase db push
npx supabase functions deploy reset-member-password --use-api
```

### 4. Testes no celular (roteiros abaixo)

## Roteiro no celular: áudio

Use o app instalado (PWA) ou o navegador, com o login de um integrante.

### Gravar um ensaio

1. **Escalas** → abra um evento do tipo **ensaio** → seção **Gravações do ensaio**.
2. **Gravar ensaio** e autorize o microfone. O cronômetro anda e aparece "tela acesa".
3. Fale ou toque uns 30 s. **Pausar**: o cronômetro congela. **Retomar**: ele volta a andar.
4. **Parar**: aparece "Gravação não enviada", com **Enviar** e **Descartar**.
5. **Enviar**: a barra de progresso enche e a gravação aparece na lista.

### Ouvir, mudar a velocidade e o tom

1. Toque o play. A gravação deve sair limpa.
2. Na tela de uma música, **Enviar áudio** com um MP3 ou M4A do celular → toque o play.
3. **75%** e **50%**: fica mais devagar e o tom não muda.
4. Suba meio tom na **cifra**: o áudio sobe junto e "Acompanhar o tom da cifra" fica marcado.
5. **−/+ do tom do áudio**: ajuste manual. "Acompanhar" desmarca.

### iPhone com a tela bloqueada

1. Comece a gravar e bloqueie a tela por uns 20 s.
2. Desbloqueie. O iPhone para a gravação quando a tela bloqueia. O que foi gravado até ali deve
   aparecer como **"não enviada"**, pronto para **Enviar**.
3. Repita mandando o app para o fundo (troque de app): o resultado deve ser o mesmo.
4. Num Android, grave 10–15 min com a tela ligada e veja se a tela não apagou e quanto de bateria
   gastou.

## Roteiro no celular: nova música colando a cifra

1. **Repertório** → **Nova música**.
2. Cole uma cifra com os acordes em cima da letra, com partes como `[Intro] G D`, `[Refrão]`.
3. Deve aparecer "Formato detectado: acordes em cima da letra", com a pré-visualização dividida
   nas partes.
4. Em **"Tom detectado na cifra"**, toque **usar**: o tom original é preenchido.
5. Preencha título e artista → **Salvar**. A música abre, e a aba **Letra** tem a letra gerada a
   partir da cifra.
6. **Transpor** +2 e −2: os acordes mudam e a letra continua alinhada.
7. Cole só uma letra, sem acordes, numa nova música: aparece "sem acordes — será salvo como
   letra".
