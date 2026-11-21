# Ministério de Louvor

App web instalável (PWA) para o ministério de louvor de uma igreja: escalas, agenda, repertório
com cifras transponíveis, comunicados e notificações — pensado para usar no celular, inclusive
tocando.

- **Escalas e agenda:** quem toca/canta em cada culto, ensaio ou evento; montar escala com
  funções; notificação para quem entra ou sai.
- **Repertório:** busca sem acento, letra e cifra (ChordPro) com troca de tom na hora, tom oficial
  e "tom do dia" de cada culto, histórico de alterações com restauração.
- **Comunicados, integrantes e notificações.**
- **Permissões por perfil** (admin e integrante) e por pessoa, garantidas no banco (RLS).

## Stack

| Parte         | Tecnologia                                                           |
| ------------- | -------------------------------------------------------------------- |
| Interface     | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, React Router |
| Dados no app  | TanStack Query, `@supabase/supabase-js`                              |
| Banco e login | Supabase (Postgres com RLS, Auth, RPCs em SQL)                       |
| PWA           | `vite-plugin-pwa` com service worker próprio (`src/sw.ts`)           |
| Testes        | Vitest (app) e pgTAP (banco, `supabase/tests`)                       |
| Hospedagem    | Cloudflare Workers (arquivos estáticos, `wrangler.jsonc`)            |

Mais detalhes de cada decisão em [`docs/diario-de-bordo.md`](docs/diario-de-bordo.md); o que
está em aberto, em [`docs/pendencias.md`](docs/pendencias.md).

## Rodar localmente

Requisitos: Node.js LTS e npm. Para o banco local, também Docker.

```bash
npm ci
cp .env.example .env.local   # preencha com a URL e a chave pública do Supabase (ver abaixo)
npm run dev                  # http://localhost:5173
```

Outros comandos:

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm test            # Vitest
npm run build       # build de produção em dist/
npm run test:coverage   # Vitest com cobertura e limites (ver "Qualidade")
npm run test:arch       # testes de arquitetura (dependency-cruiser)
```

### Banco local (opcional, com Docker)

```bash
npx supabase start       # sobe Postgres + Auth locais, aplica migrations e seed
npx supabase test db     # testes pgTAP de RLS e triggers
```

O `npx supabase start` mostra a URL e a chave pública locais para o `.env.local`.

**Igual à nuvem:** projetos novos do Supabase não concedem privilégios de tabela em `public` para
`anon`/`authenticated`, mas o Supabase local concede. Para o banco local se comportar como a
nuvem (e um GRANT esquecido aparecer como erro), suba-o assim — é o que o CI e o E2E fazem:

```bash
cp supabase/ci/simular-nuvem.sql supabase/migrations/00000000000000_simular_nuvem.sql  # fica fora do Git
npx supabase db reset    # recria o banco aplicando a simulação antes das migrations
npx supabase test db
```

Toda tabela nova precisa de GRANT explícito (ver `CLAUDE.md`); `npm run check:grants` confere.

Tipos do banco (sempre que criar uma migration):

```bash
npx supabase gen types typescript --local > src/types/database.types.ts
```

`database.types.ts` é gerado (não edite). Os tipos de domínio e o estreitamento das colunas com
CHECK ficam em `src/types/app.types.ts`.

### Teste de ponta a ponta com dados reais (CI)

O workflow **E2E (dados reais)** (`.github/workflows/e2e.yml`) roda em todo PR: sobe o Supabase
local no runner, roda o pgTAP, gera os tipos, cria os usuários demo (senha aleatória),
executa `supabase/demo-users.sql`, confere as permissões chamando a API direto
(`e2e/api-checks.mjs`) e percorre o app com Playwright nos 3 perfis, no celular e no
computador (`e2e/varredura.mjs` e `e2e/fluxos.mjs`). As capturas de tela e o relatório ficam no
artefato **e2e-output** da execução.

Para rodar na sua máquina (com o Supabase local no ar e `npm run dev`):

```bash
npm i --no-save playwright && npx playwright install chromium
eval "$(npx supabase status -o env)"
export DEMO_PASSWORD='uma-senha-só-de-teste'
node e2e/create-demo-users.mjs
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/demo-users.sql
node e2e/api-checks.mjs && node e2e/varredura.mjs && node e2e/fluxos.mjs
```

## Qualidade

Quatro camadas automáticas, todas no CI. As três primeiras rodam na sua máquina sem banco nem
Docker.

| O quê                                      | Comando                 | O que mede                                                                                                                                                                                                                     | Onde reprova                                                                                                                   |
| ------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Cobertura (teste estrutural, caixa-branca) | `npm run test:coverage` | Quanto do código os testes executam: statements, branches (cada lado de um `if`/`?:`), functions e lines                                                                                                                       | Projeto < 70% de linhas; `src/lib` < 90% de linhas ou < 85% de branches                                                        |
| Arquitetura                                | `npm run test:arch`     | As regras de dependência entre pastas (dependency-cruiser, `.dependency-cruiser.cjs`)                                                                                                                                          | `src/lib` importando React, Supabase ou camadas de cima; uma feature importando arquivo interno de outra; dependência circular |
| Mutação                                    | `npm run test:mutation` | Se os testes **percebem** quando o código muda: o Stryker altera o código ("mutantes") e confere se algum teste falha                                                                                                          | Score < 65% (limites: alto 85, baixo 70, quebra 65)                                                                            |
| QA automatizado                            | `npm run qa`            | Todas as telas em Chromium, WebKit (Safari/iPhone) e Firefox, em 375x667, 390x844, 768x1024 e 1440x900, com admin e integrante: acessibilidade (axe), console, respostas da API, largura da tela, tema escuro e casos de borda | Problema crítico ou alto                                                                                                       |

**Cobertura.** Relatório em `coverage/index.html` (no CI: artefato **cobertura** e resumo no
job). Os testes de tela usam happy-dom e Testing Library com um Supabase de mentira
(`src/test/fake-supabase.ts`, dados em `src/test/fixtures.ts`), sem rede nem banco. Para um
arquivo de teste usar o DOM, comece com `// @vitest-environment happy-dom`.

**Arquitetura.** Camadas: `src/lib` (TypeScript puro), `src/services` (cliente Supabase),
`src/hooks` (hooks React genéricos), `src/components`, `src/features/<x>` e `src/app`. Uma
feature usa outra só por `@/features/<outra>` (o `index.ts` dela).

**Mutação.** Mira `src/lib/**` e os módulos puros das features (lista em `stryker.config.mjs`).
A execução completa leva de 30 a 50 min num notebook; o relatório fica em
`reports/mutation/index.html`. Depois de uma completa, `npm run test:mutation:incremental` testa
só o que mudou. No CI, o job **Mutação** roda incremental nos PRs que mexem nesses arquivos e
completo toda segunda às 03:00 (artefato **mutacao** e score no resumo). No Windows, rode no
PowerShell aberto em `C:\` (com `C` maiúsculo), como o Vitest (pendência 2).

**QA.** Precisa do Supabase local com os usuários demo e do app rodando, como no E2E acima:

```bash
npm i --no-save playwright && npx playwright install chromium webkit firefox
BASE=http://127.0.0.1:5173 node e2e/qa.mjs
# Mais rápido: QA_BROWSERS=chromium QA_SIZES=390x844 QA_SKIP_EDGE=1 node e2e/qa.mjs
```

O resultado fica em `qa-output/` (`qa-results.json`, `resumo.md` e prints). O relatório de cada
rodada comentada fica em `docs/qa/`.

## Configurar o Supabase (projeto na nuvem)

1. Crie um projeto em [supabase.com](https://supabase.com) (o plano gratuito basta).
2. Ligue o repositório ao projeto e envie o banco (migrations + dados de demonstração):

   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_PROJECT_REF
   npx supabase db push --include-seed
   ```

   O `PROJECT_REF` está na URL do painel: `supabase.com/dashboard/project/SEU_PROJECT_REF`.

3. Em **Authentication → Sign In / Providers**, deixe **desligado** "Allow new users to sign up":
   os usuários são criados pela liderança, não por cadastro aberto.
4. Crie os usuários de demonstração em **Authentication → Users → Add user** (marque "Auto
   Confirm User"): `admin@demo.local`, `lider@demo.local` e `integrante@demo.local` — ou outros
   e-mails, trocando-os no topo do script.
5. No **SQL Editor**, rode o conteúdo de
   [`supabase/demo-users.sql`](supabase/demo-users.sql). Ele cria o perfil de quem ainda não
   tem, define papéis (admin dono, líder, integrante), funções no ministério e escalas nos eventos
   do seed. Pode rodar de novo sem duplicar nada.
6. Em **Project Settings → API**, copie a **URL** e a **chave pública** (publishable) para o
   `.env.local`:

   ```
   VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   Só valores públicos vão para o frontend. **Nunca** coloque a chave secreta / `service_role`
   no `.env.local` nem no código.

7. Em **Authentication → URL Configuration**, ponha o endereço onde o app vai rodar em "Site URL"
   (ex.: `http://localhost:5173` no desenvolvimento, o domínio da Cloudflare em produção).
8. **Regra de senha** (a mesma do app e do `supabase/config.toml`): em **Authentication →
   Providers → Email** (ou **Authentication → Policies**, conforme a versão do painel), defina
   "Minimum password length" = **10** e "Password requirements" = **Letters and digits**.

## Perfis e permissões (ADVOP)

O ministério tem **cantores**, **instrumentistas** e o **administrador**. Na prática há dois
perfis de acesso: **Integrante** (`member`) e **Administração** (`admin`). Os grupos
(cantor(a)/instrumentista) vêm das funções de cada pessoa (`ministry_functions.section`) e servem
só para selos e para filtrar a montagem de escala — **não** dão permissão.

| Permissão                | O que libera                                       | Integrante | Admin |
| ------------------------ | -------------------------------------------------- | :--------: | :---: |
| (todo integrante ativo)  | ver escalas, agenda, repertório; editar letra      |     ✅     |  ✅   |
| `chords.edit_official`   | editar a cifra (cifra nova já entra como oficial)  |     ✅     |  ✅   |
| `songs.set_official_key` | definir o tom oficial                              |     ✅     |  ✅   |
| `songs.manage`           | cadastrar música ("Nova música") e editar os dados |     ✅     |  ✅   |
| `songs.delete`           | arquivar música                                    |     —      |  ✅   |
| `history.restore`        | restaurar versões no histórico                     |     —      |  ✅   |
| `history.view_all`       | ver a **Atividade recente** de todo o repertório   |     —      |  ✅   |
| `schedules.manage`       | montar escala e o repertório do evento             |     —      |  ✅   |
| `events.manage`          | criar/editar/cancelar eventos                      |     —      |  ✅   |
| `announcements.manage`   | publicar comunicados                               |     —      |  ✅   |
| `members.manage`         | cadastrar integrantes, perfis e funções            |     —      |  ✅   |
| `members.view_contacts`  | ver o telefone dos integrantes                     |     —      |  ✅   |
| `permissions.manage`     | mudar permissões; cadastrar administradores        |     —      |  ✅   |

- O **histórico de cada música** é visível para todos; a visão geral (Atividade recente) é só do
  admin.
- Exceções por pessoa: `user_permissions` (`grant`/`deny`), que valem mais que o padrão do
  perfil.
- Quem decide é o banco (`has_permission`, RLS e triggers); esconder botão é só conforto.
- O valor `leader` continua no enum do banco, mas ninguém usa (uma CHECK impede).

## Áudios: gravação de ensaio e áudio de referência

- **Gravar ensaio** (detalhe de um evento do tipo _ensaio_): grava no próprio celular com áudio
  comprimido (Opus ~32 kbps; no iPhone, AAC ~48 kbps), com cronômetro, pausar/retomar e tela acesa
  (Wake Lock). Os pedaços vão para o **IndexedDB durante a gravação**: se o app fechar ou a
  internet cair, a gravação aparece como "não enviada". Envio com barra de progresso e "Tentar de
  novo"; aviso antes de chegar em 45 MB.
- **Áudio de referência** (tela da música): **Gravar** na hora (o mesmo gravador do ensaio:
  compressão, tela acesa, pausar/retomar, pedaços no aparelho, envio com progresso e "Tentar de
  novo", aviso de 45 MB) ou **Enviar áudio** (arquivo até 45 MB). No máximo **3 por música**.
- **Nome do áudio:** depois de gravar ou enviar, o app pede um nome (sugestões "Voz guia",
  "Arranjo", "Ensaio"; até 60 caracteres, opcional). O autor ou o admin podem **Renomear** depois.
- **Player com tom e velocidade, sem servidor:** velocidade de 50% a 100% sem mudar o tom e tom em
  semitons sem mudar o andamento, com [SoundTouch](https://github.com/cutterbl/SoundTouchJS)
  (`@soundtouchjs/audio-worklet`, MPL-2.0) num AudioWorklet. Na música, o tom do áudio
  **acompanha o tom escolhido na cifra** (diferença para o tom original), com opção de desligar.
- **Storage:** bucket privado `audios` (45 MB por arquivo, só `audio/*`), metadados em
  `media_files`. Lê e envia: integrante ativo. Apaga: o próprio autor ou o admin
  (`media.manage`).
- **Plano grátis:** 1 GB no total. O admin vê o espaço usado em **Configurações**. A partir de
  **90%**, o banco recusa áudios novos (ensaio e referência) com mensagem em português, e
  Configurações mostra o aviso; apague áudios antigos para liberar.
- **Regras no banco** (migration `20261125090000_audio_labels_limits.sql`): só a coluna `label`
  pode ser alterada (GRANT de coluna) e só pelo autor ou admin (RLS); limite de 3 referências por
  música e bloqueio de 90% garantidos por trigger em `media_files` e pela policy do bucket. O app
  consulta `check_audio_upload()` antes de enviar, para não gastar a internet à toa.
- **Retenção:** gravações de ensaio com mais de **90 dias** são apagadas todo dia pela Edge
  Function `purge-old-recordings` (pela API do Storage), chamada pelo workflow agendado
  **"Limpeza de gravações antigas"**. Áudios de referência não expiram.

### Publicar a limpeza automática

```bash
# 1. Segredo próprio da função (64 caracteres aleatórios). Guarde o valor para o passo 3.
openssl rand -hex 32
npx supabase secrets set CRON_SECRET=COLE_O_VALOR --project-ref SEU_PROJECT_REF

# 2. Publicar a função (sem verificação de JWT: quem chama é o GitHub, com o segredo)
npx supabase functions deploy purge-old-recordings --no-verify-jwt --project-ref SEU_PROJECT_REF

# 3. No GitHub (environment "staging", o mesmo do Deploy banco)
gh secret set CRON_SECRET --env staging --body "COLE_O_VALOR"
gh variable set SUPABASE_URL --env staging --body "https://SEU_PROJECT_REF.supabase.co"

# 4. Testar sem apagar nada
gh workflow run "Limpeza de gravações antigas" -f dry_run=true
```

## Visual (Louvor ADVOP)

- **Cores só por tokens** em [`src/index.css`](src/index.css): `:root` (claro) e `.dark`
  (escuro) definem `bg`, `surface`, `ink`, `muted`, `line`, `chip`, `accent`, `accent-soft`,
  `accent-text`, `chord`, `rec` e `rec-ring`. Os componentes usam as classes do Tailwind
  (`bg-surface`, `text-chord`, `bg-brand-soft`…); nenhuma cor fixa nos componentes. Um teste
  (`src/lib/theme-install.test.ts`) confere o contraste AA dos pares de texto nos dois temas.
- **Fonte Inter auto-hospedada** (`@fontsource/inter`, pesos 400–800): nada de Google Fonts.
- **Tipo:** título de tela 22/800 (`text-screen-title`), card 17/700 (`text-card-title`),
  rótulo de seção 12–13/700 em maiúsculas (`section-label`), legenda 12/500 (`text-caption`).
- **Tema claro, escuro ou automático** (segue o celular): `ThemeProvider` em
  [`src/hooks/theme-provider.tsx`](src/hooks/theme-provider.tsx), regras puras em
  [`src/lib/theme.ts`](src/lib/theme.ts), escolha guardada em `localStorage` (`louvor.theme`).
  No primeiro acesso o app pergunta "Como você prefere ver o app?"; depois, **Mais →
  Configurações → Aparência**. Um script no `index.html` aplica o tema antes de o React carregar
  (sem piscar branco à noite). O login sempre segue o tema do celular.
- **Navegação:** barra inferior no celular (Início, Escalas, Repertório, Agenda, Mais) e lateral
  no computador. **Sair** fica só no fim da tela **Mais**; notificações, só pelo sino do topo.
- **Mensagens para a pessoa** num lugar só: [`src/lib/messages.ts`](src/lib/messages.ts).
- **Capturas do visual:** o workflow **E2E (dados reais)** gera prints 390×844 nos dois temas
  (artefato `capturas-design`, `tests/e2e/capturas.spec.ts`).

## Identidade (nome da igreja)

Nome da igreja e do app ficam em [`src/config/brand.ts`](src/config/brand.ts): título da aba,
login, topo, manifest do PWA ("Louvor ADVOP") e mensagem de convite. Para outra igreja, troque só
esse arquivo.

## Cadastrar integrantes (Edge Function `invite-member`)

O cadastro público fica desligado. Quem tem a permissão `members.manage` cadastra pela tela
**Integrantes → Cadastrar integrante**, que chama a Edge Function
[`supabase/functions/invite-member`](supabase/functions/invite-member/index.ts):

1. a função confere o login e a permissão **no banco, como o próprio usuário**;
2. só então usa a service role (variável `SUPABASE_SERVICE_ROLE_KEY`, que o Supabase injeta
   sozinho nas Edge Functions — **não** existe no frontend nem no repositório) para criar a conta
   com e-mail confirmado e uma senha provisória gerada no servidor;
3. grava nome, funções e perfil pela RPC `setup_new_member` (de novo como o usuário: líder e
   admin só com `permissions.manage`) e devolve a senha **uma única vez**;
4. no primeiro acesso, o app (e o banco) bloqueiam tudo até a pessoa definir a própria senha.

### Publicar a função na nuvem

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF   # se ainda não ligou
npx supabase functions deploy invite-member
```

Não há segredo para configurar: `SUPABASE_URL`, `SUPABASE_ANON_KEY` e
`SUPABASE_SERVICE_ROLE_KEY` já existem em toda Edge Function. A verificação de JWT fica ligada
(`[functions.invite-member] verify_jwt = true` no `config.toml`). Para ver os logs:
**Edge Functions → invite-member → Logs** no painel.

### Rodar a função localmente

`npx supabase start` sobe o edge-runtime e serve as funções de `supabase/functions` em
`http://127.0.0.1:54321/functions/v1/<nome>` (se não servir, rode `npx supabase functions serve`).
O código compartilhado com o app (regra de senha, validação) fica em `supabase/functions/_shared`.

## Redefinir a senha de um integrante (Edge Function `reset-member-password`)

Não há "esqueci minha senha" por e-mail (sem SMTP). Quem esqueceu pede a um admin, que usa
**Integrantes → Redefinir senha** no cartão da pessoa. A Edge Function
[`supabase/functions/reset-member-password`](supabase/functions/reset-member-password/index.ts):

1. confere o login e chama `prepare_password_reset` **como o próprio usuário**: o banco exige
   `members.manage` e aplica as regras abaixo;
2. só então troca a senha no Auth com a service role, por uma senha provisória forte gerada no
   servidor;
3. chama `mark_password_reset` (de novo como o usuário): marca `must_change_password = true` e
   registra em `audit_logs` (`reset_password`);
4. devolve a senha **uma única vez** (`Cache-Control: no-store`). A tela mostra a senha, os botões
   de copiar e a mensagem pronta para o WhatsApp, como no cadastro.

Regras (no banco, migration `20261124090000_member_password_reset.sql`):

- ninguém redefine a senha do **dono** por aqui;
- a senha de outro **admin** só o dono redefine;
- a **própria** senha se troca em Configurações;
- a pessoa entra com a senha provisória e é **obrigada a trocar** (o banco bloqueia tudo até lá,
  inclusive sessões que já estavam abertas).

Publicar (depois do merge):

```bash
npx supabase db push --dry-run   # deve listar só 20261124090000_member_password_reset.sql
npx supabase db push
npx supabase functions deploy reset-member-password --use-api
```

`verify_jwt = true` no `config.toml`; nenhum segredo novo.

### Funções do ministério

**Integrantes → Funções do ministério** (`members.manage`) lista as funções e o grupo de cada uma
(**Cantores** ou **Instrumentistas**) e cadastra funções novas. O grupo é obrigatório: o app
pergunta e o banco recusa função sem grupo. O grupo só define selos e filtros; não dá permissão.

## Deploy do banco pelo GitHub Actions

O workflow [`.github/workflows/deploy-db.yml`](.github/workflows/deploy-db.yml) ("Deploy banco")
envia as migrations para o projeto Supabase de **staging**, sem precisar da CLI no seu computador.
Só roda quando alguém dispara à mão.

### Configurar uma vez

No GitHub: **Settings → Environments → New environment**, nome **`staging`**. Dentro dele:

| Tipo                                   | Nome                    | Valor / onde pegar                                                                                                                     |
| -------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Environment secret**                 | `SUPABASE_ACCESS_TOKEN` | Token pessoal do Supabase: [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) → Generate new token |
| **Environment secret**                 | `SUPABASE_DB_PASSWORD`  | Senha do banco do projeto (definida ao criar o projeto; para trocar: Project Settings → Database → Reset database password)            |
| **Environment variable** (não secreta) | `SUPABASE_PROJECT_REF`  | O código do projeto na URL do painel: `supabase.com/dashboard/project/SEU_PROJECT_REF`                                                 |

Os segredos nunca aparecem no log: a CLI os lê do ambiente e o GitHub mascara os valores.

**Aprovação manual (opcional):** em Settings → Environments → `staging`, marque **Required
reviewers** e escolha quem aprova. Daí em diante, cada execução espera essa aprovação antes de
tocar no banco.

### Rodar

1. Aba **Actions** → **Deploy banco** (na lista da esquerda) → **Run workflow**.
2. Escolha a branch (normalmente `main`).
3. **include_seed**: deixe **desmarcado** para enviar só as migrations. Marque apenas para
   (re)carregar os dados de demonstração — o seed não duplica o que já existe (`on conflict do
nothing`), mas é pensado para ambiente de teste, não para dados reais.
4. **Run workflow**. O passo "Prévia (dry run)" lista no log o que vai ser aplicado antes do passo
   "Enviar migrations".

Os usuários de demonstração continuam sendo criados no painel + `supabase/demo-users.sql` (passos
4 e 5 da seção anterior); o workflow não mexe no Auth.

## Backup diário do banco

O banco da nuvem tem backup diário **criptografado** (madrugada, 03:17 de Brasília), guardado por
**30 dias** como artefato do GitHub Actions. Ele também serve de keep-alive contra a pausa do
plano grátis.

- Roda no repositório **privado** [`gabryelcetto/ministerio-louvor-ops`](https://github.com/gabryelcetto/ministerio-louvor-ops)
  (este repositório é público).
- Cópia versionada, scripts e passo a passo (chaves `age`, secrets, restauração):
  [`ops/backup/`](ops/backup/README.md).
- O workflow **Backup (autoteste)** prova a cada mudança que o backup restaura: faz o backup de um
  Supabase local, restaura num segundo Supabase local vazio e compara as tabelas.
- **Os arquivos do Storage (áudios) não entram no dump.**

## Publicar (Cloudflare Workers)

```bash
npm run build
npx wrangler deploy
```

Na Cloudflare, defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` como variáveis do
**build** (são lidas pelo Vite na hora de gerar o `dist/`).

O app não deve aparecer em buscadores: `public/robots.txt` bloqueia robôs e o `index.html` tem
`noindex, nofollow`. Isso não é segurança — os dados são protegidos pelo login e pelo RLS.

## Ícones

A chama do Louvor ADVOP (favicon, 192, 512, maskable 512 e apple-touch 180) é gerada por script
a partir do SVG aprovado. Os PNGs ficam no Git; só rode quando o ícone mudar. O `sharp` é
instalado sem salvar no `package.json`:

```bash
npm i --no-save sharp && node scripts/generate-icons.mjs
```

No app, o mesmo desenho é o componente `<FlameLogo>` (`src/components/brand/flame-logo.tsx`).

## Licença

**Proprietária — todos os direitos reservados.** O código está visível no GitHub, mas não há
licença de uso: não é permitido copiar, modificar, distribuir ou usar este código, no todo ou em
parte, sem autorização por escrito do titular. O `package.json` declara `"license":
"UNLICENSED"`.

Os hinos do seed são de domínio público (autor do texto em português falecido há mais de 70
anos) ou textos fictícios marcados "(exemplo)".
