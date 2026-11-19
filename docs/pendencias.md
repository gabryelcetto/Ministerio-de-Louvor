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
