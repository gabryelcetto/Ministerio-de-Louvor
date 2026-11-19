# Ministério de Louvor

App web instalável (PWA) para o ministério de louvor de uma igreja: escalas, agenda, repertório
com cifras transponíveis, comunicados e notificações — pensado para usar no celular, inclusive
tocando.

- **Escalas e agenda:** quem toca/canta em cada culto, ensaio ou evento; montar escala com
  funções; notificação para quem entra ou sai.
- **Repertório:** busca sem acento, letra e cifra (ChordPro) com troca de tom na hora, tom oficial
  e "tom do dia" de cada culto, histórico de alterações com restauração.
- **Comunicados, integrantes e notificações.**
- **Permissões por perfil** (admin, líder, integrante) e por pessoa, garantidas no banco (RLS).

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
```

### Banco local (opcional, com Docker)

```bash
npx supabase start       # sobe Postgres + Auth locais, aplica migrations e seed
npx supabase test db     # testes pgTAP de RLS e triggers
```

O `npx supabase start` mostra a URL e a chave pública locais para o `.env.local`.

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

Os ícones do PWA são gerados por script, sem dependências:

```bash
node scripts/generate-icons.mjs
```

## Licença

**Proprietária — todos os direitos reservados.** O código está visível no GitHub, mas não há
licença de uso: não é permitido copiar, modificar, distribuir ou usar este código, no todo ou em
parte, sem autorização por escrito do titular. O `package.json` declara `"license":
"UNLICENSED"`.

Os hinos do seed são de domínio público (autor do texto em português falecido há mais de 70
anos) ou textos fictícios marcados "(exemplo)".
