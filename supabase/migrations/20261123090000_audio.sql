-- =============================================================================
-- ÁUDIOS: gravações de ensaio e áudios de referência por música (Supabase Storage).
--
-- Limites do plano grátis: 1 GB no total e 50 MB por arquivo. O bucket aceita até 45 MB por
-- arquivo (margem) e só audio/*. Gravações de ensaio com mais de 90 dias são apagadas pela
-- Edge Function `purge-old-recordings` (pela API do Storage, nunca direto em storage.objects).
-- Áudios de referência não expiram.
-- =============================================================================

-- Bucket privado -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audios', 'audios', false, 47185920, array['audio/*'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Permissão nova (admin): apagar áudio de qualquer pessoa e ver o espaço usado ----------------
insert into public.permissions (key, description) values
  ('media.manage', 'Apagar áudios de qualquer pessoa e ver o espaço usado no Storage')
on conflict (key) do nothing;
insert into public.role_permissions (role, permission_key) values ('admin', 'media.manage')
on conflict do nothing;

-- Tabela --------------------------------------------------------------------------------------
create table public.media_files (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('rehearsal', 'reference')),
  event_id uuid references public.events (id) on delete cascade,
  song_id uuid references public.songs (id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type like 'audio/%'),
  duration_seconds numeric(10, 2) check (duration_seconds is null or duration_seconds >= 0),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 47185920),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  -- Gravação de ensaio pertence a um evento; referência pertence a uma música.
  constraint media_files_target check (
    (kind = 'rehearsal' and event_id is not null and song_id is null)
    or (kind = 'reference' and song_id is not null and event_id is null)
  ),
  -- Caminho no bucket: rehearsal/<evento>/<arquivo> ou reference/<música>/<arquivo>.
  constraint media_files_path check (
    storage_path like kind || '/' || coalesce(event_id, song_id)::text || '/%'
  )
);
create index media_files_event_idx on public.media_files (event_id, created_at desc);
create index media_files_song_idx on public.media_files (song_id, created_at desc);
create index media_files_rehearsal_age_idx on public.media_files (created_at) where kind = 'rehearsal';

comment on table public.media_files is
  'Metadados dos áudios do bucket "audios" (o arquivo fica no Storage).';

-- GRANT explícito (regra do projeto). Sem policy de UPDATE: ninguém altera um áudio enviado.
grant select, insert, update, delete on public.media_files to authenticated;
-- A limpeza automática (Edge Function com a service role) lê e apaga os registros. Em projeto
-- novo da nuvem nem a service_role tem privilégio garantido em public: GRANT explícito também.
grant select, delete on public.media_files to service_role;

alter table public.media_files enable row level security;

create policy "media_files: integrantes ativos leem"
  on public.media_files for select to authenticated
  using (public.is_active_member());

create policy "media_files: integrante ativo envia em nome próprio"
  on public.media_files for insert to authenticated
  with check (
    public.is_active_member()
    and created_by = (select auth.uid())
    -- gravação só em evento do tipo ensaio
    and (
      kind = 'reference'
      or exists (select 1 from public.events e where e.id = event_id and e.type = 'ensaio')
    )
  );

create policy "media_files: autor ou admin apaga"
  on public.media_files for delete to authenticated
  using (
    public.is_active_member()
    and (created_by = (select auth.uid()) or public.has_permission('media.manage'))
  );

-- Storage: policies do bucket "audios" ---------------------------------------------------------
-- Pasta 1 do caminho = 'rehearsal' ou 'reference'. Sem UPDATE: não se sobrescreve áudio.
drop policy if exists "audios: integrantes ativos leem" on storage.objects;
drop policy if exists "audios: integrantes ativos enviam" on storage.objects;
drop policy if exists "audios: autor ou admin apaga" on storage.objects;

create policy "audios: integrantes ativos leem"
  on storage.objects for select to authenticated
  using (bucket_id = 'audios' and public.is_active_member());

create policy "audios: integrantes ativos enviam"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'audios'
    and public.is_active_member()
    and (storage.foldername(name))[1] in ('rehearsal', 'reference')
  );

create policy "audios: autor ou admin apaga"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'audios'
    and public.is_active_member()
    and (owner_id = (select auth.uid())::text or public.has_permission('media.manage'))
  );

-- Espaço usado (Configurações, só admin) -------------------------------------------------------
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
    'total_bytes', (
      select coalesce(sum((o.metadata ->> 'size')::bigint), 0)
      from storage.objects o where o.bucket_id = 'audios'
    ),
    'rehearsal_bytes', (
      select coalesce(sum(size_bytes), 0) from public.media_files where kind = 'rehearsal'
    ),
    'reference_bytes', (
      select coalesce(sum(size_bytes), 0) from public.media_files where kind = 'reference'
    ),
    'files', (select count(*) from public.media_files),
    'limit_bytes', 1073741824
  );
end;
$$;

revoke execute on function public.get_storage_usage() from anon, public;
grant execute on function public.get_storage_usage() to authenticated;

-- Retenção (só a Edge Function, com a service role) -------------------------------------------
-- Lista o que deve ser apagado PELA API DO STORAGE: gravações de ensaio com mais de 90 dias e
-- arquivos do bucket sem linha em media_files há mais de 1 dia (upload que não terminou).
create or replace function public.audio_files_to_purge(p_days integer default 90)
returns table (storage_path text, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.storage_path, 'gravação de ensaio com mais de ' || p_days || ' dias'
  from public.media_files m
  where m.kind = 'rehearsal' and m.created_at < now() - make_interval(days => p_days)
  union all
  select o.name, 'arquivo sem registro'
  from storage.objects o
  where o.bucket_id = 'audios'
    and o.created_at < now() - interval '1 day'
    and not exists (select 1 from public.media_files m where m.storage_path = o.name);
$$;

revoke execute on function public.audio_files_to_purge(integer) from anon, authenticated, public;
grant execute on function public.audio_files_to_purge(integer) to service_role;
