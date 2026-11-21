# Backup diário do banco (Supabase)

Backup automático do banco da nuvem: todo dia às **03:17 (Brasília)** e quando você quiser
(botão "Run workflow"). O backup é **criptografado** antes de sair do runner e fica guardado
**30 dias** como artefato do GitHub Actions.

> **Onde roda:** no repositório **privado** `gabryelcetto/ministerio-louvor-ops`
> (`.github/workflows/backup.yml`). Este repositório do app é público, e mesmo criptografado um
> backup não deve ficar em lugar público. A cópia de referência do workflow fica aqui em
> [`backup.yml`](backup.yml); ela não roda neste repositório.

## O que entra e o que NÃO entra

| Entra (criptografado)                                   | NÃO entra                                         |
| ------------------------------------------------------- | ------------------------------------------------- |
| `roles.sql` — papéis do banco                           | **Arquivos do Storage** (áudios dos ensaios etc.) |
| `schema.sql` — tabelas, funções, policies               | Configurações do painel (Auth, regra de senha…)   |
| `data.sql` — dados (inclusive usuários do Auth, perfis) | Edge Functions (o código está no Git)             |

> ⚠️ **Áudios não entram no dump.** O banco guarda só a referência (`media_files`); o arquivo
> fica no Storage. Para guardar os áudios, baixe-os pelo painel (Storage → audios) de tempos em
> tempos. Gravações de ensaio são apagadas automaticamente depois de 90 dias.

## Configurar (uma vez)

### 1. Gerar o par de chaves `age` — na SUA máquina

[`age`](https://github.com/FiloSottile/age) é uma ferramenta simples de criptografia.
Instale (`winget install FiloSottile.age` no Windows, `brew install age` no Mac,
`sudo apt install age` no Linux) e rode:

```bash
age-keygen -o louvor-backup-chave-privada.txt
```

O comando mostra a **chave pública** (`Public key: age1…`). O arquivo
`louvor-backup-chave-privada.txt` é a **chave privada**:

- guarde-a **fora do GitHub** (gerenciador de senhas, pendrive, e uma cópia impressa);
- **sem ela nenhum backup pode ser aberto** — nem por você;
- nunca coloque a chave privada em secret, issue, commit ou chat.

### 2. Pegar a conexão do banco

No painel do Supabase → **Connect** → **Session pooler** → copie a URI. Ela tem este formato
(troque `[YOUR-PASSWORD]` pela senha do banco):

```
postgresql://postgres.SEU_PROJECT_REF:SENHA@aws-0-REGIAO.pooler.supabase.com:5432/postgres
```

Use o **Session pooler** (IPv4): a conexão direta (`db.SEU_PROJECT_REF.supabase.co`) é só IPv6
no plano grátis e o GitHub Actions não alcança.

### 3. Cadastrar no repositório privado

Em `gabryelcetto/ministerio-louvor-ops` → **Settings → Secrets and variables → Actions**:

| Tipo     | Nome                       | Valor                                              |
| -------- | -------------------------- | -------------------------------------------------- |
| Secret   | `SUPABASE_DB_URL`          | a URI do passo 2                                   |
| Secret   | `AGE_PUBLIC_KEY`           | a chave **pública** (`age1…`) do passo 1           |
| Variable | `SUPABASE_URL` (opcional)  | `https://SEU_PROJECT_REF.supabase.co` (keep-alive) |
| Variable | `SUPABASE_PUBLISHABLE_KEY` | chave pública do projeto (opcional, keep-alive)    |

Pelo terminal (com o `gh` logado), o mesmo:

```bash
gh secret set SUPABASE_DB_URL --repo gabryelcetto/ministerio-louvor-ops        # cola a URI quando pedir
gh secret set AGE_PUBLIC_KEY --repo gabryelcetto/ministerio-louvor-ops --body "age1..."
gh variable set SUPABASE_URL --repo gabryelcetto/ministerio-louvor-ops --body "https://SEU_PROJECT_REF.supabase.co"
gh variable set SUPABASE_PUBLISHABLE_KEY --repo gabryelcetto/ministerio-louvor-ops --body "sb_publishable_..."
```

### 4. Testar

```bash
gh workflow run "Backup do banco" --repo gabryelcetto/ministerio-louvor-ops
gh run watch --repo gabryelcetto/ministerio-louvor-ops
```

O artefato `louvor-backup-AAAA-MM-DDTHHMMZ.tar.gz.age` aparece na execução (aba **Actions**).

## Restaurar um backup (para testar num Supabase local)

Faça isso de vez em quando: **backup que nunca foi restaurado não é backup**.

```bash
# 1. Baixar o artefato (ou pela aba Actions → execução → Artifacts)
gh run download --repo gabryelcetto/ministerio-louvor-ops -n louvor-backup-AAAA-MM-DDTHHMMZ.tar.gz.age

# 2. Abrir com a chave PRIVADA
mkdir restaurar
age --decrypt -i louvor-backup-chave-privada.txt louvor-backup-AAAA-MM-DDTHHMMZ.tar.gz.age | tar -xzf - -C restaurar

# 3. Um Supabase local VAZIO (pasta nova, sem as migrations do app)
mkdir teste-restauracao && cd teste-restauracao
npx supabase init
npx supabase db start

# 4. Restaurar (ordem e opções do guia oficial do Supabase)
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  --single-transaction --variable ON_ERROR_STOP=1 \
  --file ../restaurar/roles.sql \
  --file ../restaurar/schema.sql \
  --command 'SET session_replication_role = replica' \
  --file ../restaurar/data.sql

# 5. Conferir
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select count(*) from public.songs;"
```

Sem `psql` instalado, use o do container: troque `psql "postgresql://…"` por
`docker exec -i supabase_db_teste-restauracao psql -U postgres -d postgres` e passe os arquivos
com `<` (um por vez, na mesma ordem).

Restaurar **na nuvem** (desastre de verdade) é o mesmo comando com a URI do projeto novo no lugar
de `127.0.0.1:54322` — faça primeiro o teste local.

## Keep-alive

Projetos do plano grátis pausam depois de alguns dias sem atividade. O backup diário conecta no
banco (e, com as variables opcionais, chama a API do Auth), o que conta como atividade.

## Custos

Zero: GitHub Actions em repositório privado tem minutos grátis por mês (cada backup usa ~2–3
min) e os artefatos ficam dentro da cota grátis de armazenamento. `age` e a CLI do Supabase são
livres.
