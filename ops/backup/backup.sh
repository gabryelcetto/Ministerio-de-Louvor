#!/usr/bin/env bash
# Backup do banco do Supabase: dump (roles, schema, dados) → tar.gz → criptografado com age.
#
# Uso:
#   SUPABASE_DB_URL='postgresql://…' AGE_PUBLIC_KEY='age1…' ./backup.sh [pasta-de-saída]
# Imprime o caminho do arquivo gerado (louvor-backup-AAAA-MM-DDTHHMMZ.tar.gz.age).
# Precisa de: Supabase CLI 3.x (usa Docker para o pg_dump), age, tar.
set -euo pipefail

out="${1:-.}"
: "${SUPABASE_DB_URL:?Defina SUPABASE_DB_URL (string de conexão do banco)}"
: "${AGE_PUBLIC_KEY:?Defina AGE_PUBLIC_KEY (chave pública age1…)}"
case "$AGE_PUBLIC_KEY" in
  age1*) ;;
  *) echo "AGE_PUBLIC_KEY deve começar com age1 (é a chave PÚBLICA)." >&2; exit 1 ;;
esac

umask 077
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
export SUPABASE_YES=true # nunca parar esperando confirmação

# Ordem do guia oficial de backup do Supabase. Na CLI 3, banco remoto = --remote=<url>.
supabase db dump --remote="$SUPABASE_DB_URL" --role-only -f "$work/roles.sql" >&2
supabase db dump --remote="$SUPABASE_DB_URL" -f "$work/schema.sql" >&2
# Tabelas internas do recurso de vetores do Storage (não usado pelo app): o usuário postgres não
# pode gravá-las na restauração. buckets e objects (os áudios do app) continuam no backup.
supabase db dump --remote="$SUPABASE_DB_URL" --data-only --use-copy \
  -x storage.buckets_vectors,storage.vector_indexes \
  -f "$work/data.sql" >&2

# Dump vazio é falha, não sucesso.
for f in roles schema data; do
  [ -s "$work/$f.sql" ] || { echo "Dump vazio: $f.sql" >&2; exit 1; }
done

mkdir -p "$out"
file="$out/louvor-backup-$(date -u +%Y-%m-%dT%H%MZ).tar.gz.age"
tar -czf - -C "$work" roles.sql schema.sql data.sql | age --encrypt -r "$AGE_PUBLIC_KEY" -o "$file"
echo "$file"
