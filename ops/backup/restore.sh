#!/usr/bin/env bash
# Restaura um backup gerado por backup.sh num banco Supabase VAZIO (local ou um projeto novo).
#
# Uso:
#   ./restore.sh louvor-backup-….tar.gz.age louvor-backup-chave-privada.txt 'postgresql://…'
# Teste local: o banco de um "supabase init" + "supabase db start" numa pasta nova
#   (postgresql://postgres:postgres@127.0.0.1:54322/postgres).
# Precisa de: age, tar, psql.
set -euo pipefail

file="${1:?Informe o arquivo .tar.gz.age}"
key="${2:?Informe o arquivo da chave PRIVADA do age}"
url="${3:?Informe a string de conexão do banco de destino}"

umask 077
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

age --decrypt -i "$key" "$file" | tar -xzf - -C "$work"

# Ordem e opções do guia oficial de restauração do Supabase.
psql "$url" \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$work/roles.sql" \
  --file "$work/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$work/data.sql"

echo "Restauração concluída."
