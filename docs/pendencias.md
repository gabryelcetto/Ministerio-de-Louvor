# Pendências

Itens que dependem do dono do projeto ou que ficaram em aberto. Cada item diz **o quê**, **por quê** e
**o que fazer**.

## Abertas

### 1. Branch `main` não existe no GitHub (bloqueia o PR da fase A)

- **O quê:** o repositório remoto estava vazio. A regra proíbe push na `main`, então o commit inicial
  (`chore: commit inicial`, vazio) existe só localmente e é a base da branch `feat/fase-a-fundacao`.
- **Por quê:** sem `main` no GitHub não dá para abrir PR apontando para ela.
- **O que fazer (uma vez):**
  ```bash
  git push origin main          # publica só o commit inicial vazio
  gh pr create --base main --head feat/fase-a-fundacao --fill
  ```
  Alternativa sem terminal local: no GitHub, crie a branch `main` a partir do primeiro commit da
  `feat/fase-a-fundacao` e abra o PR pela interface.

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
