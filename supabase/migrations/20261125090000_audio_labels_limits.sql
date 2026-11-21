-- =============================================================================
-- ÁUDIOS: nome do áudio, limite de 3 referências por música e bloqueio de envios a 90% do 1 GB.
-- Idempotente (if not exists / drop ... if exists / create or replace / revoke + grant).
--
-- 1. media_files.label: nome opcional (até 60 caracteres: "Voz guia", "Arranjo", "Ensaio"…).
--    Só a coluna label pode ser alterada (GRANT de coluna) e só pelo autor ou admin (RLS).
-- 2. Até 3 áudios de referência por música (trigger, com trava para envios simultâneos).
-- 3. Uso do bucket "audios" a partir de 90% de 1 GB: novos envios (ensaio e referência) são
--    recusados, no bucket (policy) e no registro (trigger). Admin vê o aviso em Configurações.
-- O app consulta check_audio_upload() ANTES de enviar o arquivo, para a mensagem sair em
-- português sem gastar a internet da pessoa; a garantia é a policy + o trigger.
-- =============================================================================

-- 1. Nome do áudio -----------------------------------------------------------------------------
alter table public.media_files add column if not exists label text;

alter table public.media_files drop constraint if exists media_files_label_check;
alter table public.media_files add constraint media_files_label_check
  check (label is null or (btrim(label) <> '' and char_length(label) <= 60));

comment on column public.media_files.label is
  'Nome do áudio (opcional, até 60 caracteres). Editável só pelo autor ou admin.';

-- Antes: UPDATE na tabela toda (sem policy, ninguém alterava). Agora: só a coluna label.
revoke update on public.media_files from authenticated;
grant update (label) on public.media_files to authenticated;

drop policy if exists "media_files: autor ou admin renomeia" on public.media_files;
create policy "media_files: autor ou admin renomeia"
  on public.media_files for update to authenticated
  using (
    public.is_active_member()
    and (created_by = (select auth.uid()) or public.has_permission('media.manage'))
  )
  with check (
    public.is_active_member()
    and (created_by = (select auth.uid()) or public.has_permission('media.manage'))
  );

-- 2 e 3. Limites -------------------------------------------------------------------------------
-- Plano grátis: 1 GB no total. Bloqueio de novos envios a partir de 90%.
create or replace function public.audio_upload_block_bytes()
returns bigint
language sql
immutable
set search_path = ''
as $$
  select floor(1073741824 * 0.9)::bigint;
$$;

-- Funções voláteis de propósito: cada chamada enxerga o que outras transações já gravaram
-- (STABLE usaria a "foto" do início do comando e furaria a trava de envios simultâneos).
create or replace function public.audio_used_bytes(p_except_path text default null)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)
  from storage.objects o
  where o.bucket_id = 'audios'
    and (p_except_path is null or o.name <> p_except_path);
$$;

create or replace function public.audio_reference_count(p_song uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  select count(*)::int from public.media_files m
  where m.kind = 'reference' and m.song_id = p_song;
$$;

-- Motivo para recusar um envio novo (null = pode enviar). `p_except_path`: o próprio arquivo,
-- que já está no bucket quando o registro é gravado em media_files.
create or replace function public.audio_upload_problem(
  p_kind text,
  p_target uuid,
  p_except_path text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.audio_used_bytes(p_except_path) >= public.audio_upload_block_bytes() then
    return 'O espaço dos áudios passou de 90% de 1 GB. Novos envios estão bloqueados até um '
      || 'admin apagar áudios antigos.';
  end if;
  if p_kind = 'reference' and public.audio_reference_count(p_target) >= 3 then
    return 'Esta música já tem 3 áudios de referência. Apague um para enviar outro.';
  end if;
  return null;
end;
$$;

revoke execute on function public.audio_used_bytes(text) from public, anon, authenticated;
revoke execute on function public.audio_reference_count(uuid) from public, anon, authenticated;
revoke execute on function public.audio_upload_problem(text, uuid, text) from public, anon, authenticated;

-- Consulta do app antes de enviar (mensagem em português, sem gastar a internet à toa).
create or replace function public.check_audio_upload(p_kind text, p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_problem text;
begin
  if not public.is_active_member() then
    raise exception 'Sem permissão para enviar áudios.' using errcode = '42501';
  end if;
  v_problem := public.audio_upload_problem(p_kind, p_target, null);
  if v_problem is not null then
    raise exception '%', v_problem using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.check_audio_upload(text, uuid) from public, anon;
grant execute on function public.check_audio_upload(text, uuid) to authenticated;

-- Garantia no registro (antes de gravar): trava por música + espaço.
create or replace function public.media_files_enforce_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Dois envios ao mesmo tempo para a mesma música esperam um pelo outro (a contagem do
  -- trigger AFTER abaixo enxerga o que o outro gravou).
  if new.kind = 'reference' then
    perform pg_advisory_xact_lock(hashtextextended('media_reference:' || new.song_id::text, 0));
  end if;
  if public.audio_used_bytes(new.storage_path) >= public.audio_upload_block_bytes() then
    raise exception 'O espaço dos áudios passou de 90%% de 1 GB. Novos envios estão bloqueados até um admin apagar áudios antigos.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Garantia no registro (depois de gravar): no máximo 3 referências por música. AFTER conta
-- também as linhas do mesmo comando (um INSERT com várias linhas não escapa do limite).
create or replace function public.media_files_reference_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'reference' and public.audio_reference_count(new.song_id) > 3 then
    raise exception 'Esta música já tem 3 áudios de referência. Apague um para enviar outro.'
      using errcode = 'P0001';
  end if;
  return null;
end;
$$;

revoke execute on function public.media_files_enforce_limits() from public, anon, authenticated;
revoke execute on function public.media_files_reference_limit() from public, anon, authenticated;

drop trigger if exists media_files_enforce_limits on public.media_files;
create trigger media_files_enforce_limits
before insert on public.media_files
for each row execute function public.media_files_enforce_limits();

drop trigger if exists media_files_reference_limit on public.media_files;
create trigger media_files_reference_limit
after insert on public.media_files
for each row execute function public.media_files_reference_limit();

-- Garantia no bucket: o arquivo nem entra (pasta certa + limites).
create or replace function public.audio_upload_allowed(p_name text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_folders text[] := storage.foldername(p_name);
begin
  if v_folders[1] is null or v_folders[1] not in ('rehearsal', 'reference') then
    return false;
  end if;
  if v_folders[2] is null
     or v_folders[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.audio_upload_problem(v_folders[1], v_folders[2]::uuid, null) is null;
end;
$$;

revoke execute on function public.audio_upload_allowed(text) from public, anon;
grant execute on function public.audio_upload_allowed(text) to authenticated;

drop policy if exists "audios: integrantes ativos enviam" on storage.objects;
create policy "audios: integrantes ativos enviam"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'audios'
    and public.is_active_member()
    and public.audio_upload_allowed(name)
  );

-- Espaço usado (Configurações, só admin): agora informa também o ponto de bloqueio ------------
create or replace function public.get_storage_usage()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('media.manage') then
    raise exception 'Sem permissão para ver o espaço usado.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total_bytes', public.audio_used_bytes(null),
    'rehearsal_bytes', (
      select coalesce(sum(size_bytes), 0) from public.media_files where kind = 'rehearsal'
    ),
    'reference_bytes', (
      select coalesce(sum(size_bytes), 0) from public.media_files where kind = 'reference'
    ),
    'files', (select count(*) from public.media_files),
    'limit_bytes', 1073741824,
    'block_bytes', public.audio_upload_block_bytes()
  );
end;
$$;

revoke execute on function public.get_storage_usage() from anon, public;
grant execute on function public.get_storage_usage() to authenticated;
