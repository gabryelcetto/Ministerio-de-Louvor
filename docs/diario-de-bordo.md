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
