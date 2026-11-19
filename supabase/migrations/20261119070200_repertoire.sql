-- =============================================================================
-- 3/4 REPERTÓRIO: músicas, letras, cifras, histórico de versões, favoritos,
-- repertório dos eventos e busca sem acento.
-- =============================================================================

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  category text,
  original_key text,
  official_key text,
  media_url text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.song_lyrics (
  song_id uuid primary key references public.songs (id) on delete cascade,
  content text not null default '',
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

create table public.song_chords (
  song_id uuid primary key references public.songs (id) on delete cascade,
  content text not null default '', -- formato ChordPro: [G]Texto
  review_status text not null default 'official' check (review_status in ('official', 'pending')),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

-- Histórico: só inserção, gravado por trigger (security definer).
create table public.song_versions (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs (id) on delete cascade,
  field text not null check (field in ('lyrics', 'chords', 'official_key', 'metadata')),
  old_value text,
  new_value text,
  change_type text not null check (change_type in ('create', 'update', 'restore')),
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index song_versions_song_idx on public.song_versions (song_id, changed_at desc);

create table public.song_favorites (
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  song_id uuid not null references public.songs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, song_id)
);

-- Repertório de um evento (ordem e tom do dia).
create table public.event_songs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  song_id uuid not null references public.songs (id) on delete restrict,
  position smallint not null default 1,
  key_for_event text,
  notes text,
  unique (event_id, position)
);

-- Busca sem acento ----------------------------------------------------------------
-- unaccent() não é IMMUTABLE; este wrapper fixa o dicionário para poder indexar.
create or replace function public.immutable_unaccent(value text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, value);
$$;

create index songs_title_trgm_idx on public.songs
  using gin (public.immutable_unaccent(lower(title)) extensions.gin_trgm_ops);
create index songs_artist_trgm_idx on public.songs
  using gin (public.immutable_unaccent(lower(coalesce(artist, ''))) extensions.gin_trgm_ops);

-- search_songs('castelo') — RLS continua valendo (security invoker).
create or replace function public.search_songs(q text)
returns setof public.songs
language sql
stable
set search_path = ''
as $$
  select s.*
  from public.songs s
  where s.archived_at is null
    and (
      coalesce(trim(q), '') = ''
      or public.immutable_unaccent(lower(s.title)) like '%' || public.immutable_unaccent(lower(trim(q))) || '%'
      or public.immutable_unaccent(lower(coalesce(s.artist, ''))) like '%' || public.immutable_unaccent(lower(trim(q))) || '%'
    )
  order by s.title;
$$;

-- Triggers -------------------------------------------------------------------------
create trigger songs_set_updated_at
before update on public.songs
for each row execute function public.set_updated_at();

-- Tipo da alteração: 'restore' quando vem de restore_song_version(), senão create/update.
create or replace function public.current_change_type(op text)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when coalesce(current_setting('app.change_type', true), '') = 'restore' then 'restore'
    when op = 'INSERT' then 'create'
    else 'update'
  end;
$$;

-- official_key só muda com songs.set_official_key.
-- auth.uid() nulo = contexto administrativo (seed/migrations/SQL Editor).
create or replace function public.guard_song_official_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.official_key is not null and not public.has_permission('songs.set_official_key') then
      raise exception 'Sem permissão para definir o tom oficial da música.'
        using errcode = '42501';
    end if;
  elsif new.official_key is distinct from old.official_key
        and not public.has_permission('songs.set_official_key') then
    raise exception 'Sem permissão para alterar o tom oficial da música.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger songs_guard_official_key
before insert or update on public.songs
for each row execute function public.guard_song_official_key();

-- Grava versões de tom oficial e de metadados.
create or replace function public.log_song_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := public.current_change_type(tg_op);
  v_old jsonb;
  v_new jsonb;
begin
  v_new := jsonb_build_object(
    'title', new.title, 'artist', new.artist, 'category', new.category,
    'original_key', new.original_key, 'media_url', new.media_url, 'notes', new.notes
  );
  if tg_op = 'INSERT' then
    insert into public.song_versions (song_id, field, old_value, new_value, change_type, changed_by)
    values (new.id, 'metadata', null, v_new::text, v_type, (select auth.uid()));
    if new.official_key is not null then
      insert into public.song_versions (song_id, field, old_value, new_value, change_type, changed_by)
      values (new.id, 'official_key', null, new.official_key, v_type, (select auth.uid()));
    end if;
    return new;
  end if;

  v_old := jsonb_build_object(
    'title', old.title, 'artist', old.artist, 'category', old.category,
    'original_key', old.original_key, 'media_url', old.media_url, 'notes', old.notes
  );
  if v_new is distinct from v_old then
    insert into public.song_versions (song_id, field, old_value, new_value, change_type, changed_by)
    values (new.id, 'metadata', v_old::text, v_new::text, v_type, (select auth.uid()));
  end if;
  if new.official_key is distinct from old.official_key then
    insert into public.song_versions (song_id, field, old_value, new_value, change_type, changed_by)
    values (new.id, 'official_key', old.official_key, new.official_key, v_type, (select auth.uid()));
  end if;
  return new;
end;
$$;

create trigger songs_log_version
after insert or update on public.songs
for each row execute function public.log_song_version();

-- Letra e cifra: carimbo de autor/data e histórico.
create or replace function public.stamp_song_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;

create trigger song_lyrics_stamp
before insert or update on public.song_lyrics
for each row execute function public.stamp_song_content();

create trigger song_chords_stamp
before insert or update on public.song_chords
for each row execute function public.stamp_song_content();

-- Cifra enviada por quem não tem chords.edit_official nasce "pending".
create or replace function public.guard_song_chords_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.has_permission('chords.edit_official') then
    new.review_status := 'pending';
  end if;
  return new;
end;
$$;

create trigger song_chords_guard_insert
before insert on public.song_chords
for each row execute function public.guard_song_chords_insert();

create or replace function public.log_song_content_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_field text := case tg_table_name when 'song_lyrics' then 'lyrics' else 'chords' end;
begin
  if tg_op = 'UPDATE' and new.content is not distinct from old.content then
    return new;
  end if;
  insert into public.song_versions (song_id, field, old_value, new_value, change_type, changed_by)
  values (
    new.song_id,
    v_field,
    case when tg_op = 'UPDATE' then old.content end,
    new.content,
    public.current_change_type(tg_op),
    (select auth.uid())
  );
  return new;
end;
$$;

create trigger song_lyrics_log_version
after insert or update on public.song_lyrics
for each row execute function public.log_song_content_version();

create trigger song_chords_log_version
after insert or update on public.song_chords
for each row execute function public.log_song_content_version();

-- Restaurar versão: confere permissão e grava como NOVA alteração (change_type = restore).
create or replace function public.restore_song_version(version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.song_versions%rowtype;
  m jsonb;
begin
  if not public.has_permission('history.restore') then
    raise exception 'Sem permissão para restaurar versões.' using errcode = '42501';
  end if;

  select * into v from public.song_versions where id = version_id;
  if not found then
    raise exception 'Versão não encontrada.' using errcode = 'P0002';
  end if;

  -- O valor restaurado é o new_value daquela versão (o estado logo após a alteração).
  perform set_config('app.change_type', 'restore', true);

  case v.field
    when 'lyrics' then
      insert into public.song_lyrics (song_id, content) values (v.song_id, coalesce(v.new_value, ''))
      on conflict (song_id) do update set content = excluded.content;
    when 'chords' then
      insert into public.song_chords (song_id, content, review_status)
      values (v.song_id, coalesce(v.new_value, ''), 'official')
      on conflict (song_id) do update set content = excluded.content, review_status = 'official';
    when 'official_key' then
      update public.songs set official_key = v.new_value where id = v.song_id;
    when 'metadata' then
      m := v.new_value::jsonb;
      update public.songs set
        title = coalesce(m ->> 'title', title),
        artist = m ->> 'artist',
        category = m ->> 'category',
        original_key = m ->> 'original_key',
        media_url = m ->> 'media_url',
        notes = m ->> 'notes'
      where id = v.song_id;
  end case;

  perform set_config('app.change_type', '', true);

  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values ((select auth.uid()), 'restore_version', 'song', v.song_id::text,
          jsonb_build_object('version_id', v.id, 'field', v.field));
end;
$$;

revoke execute on function public.restore_song_version(uuid) from anon, public;
grant execute on function public.restore_song_version(uuid) to authenticated;
revoke execute on function public.search_songs(text) from anon, public;
grant execute on function public.search_songs(text) to authenticated;

-- RLS -------------------------------------------------------------------------------
alter table public.songs enable row level security;
alter table public.song_lyrics enable row level security;
alter table public.song_chords enable row level security;
alter table public.song_versions enable row level security;
alter table public.song_favorites enable row level security;
alter table public.event_songs enable row level security;

-- songs: todos os ativos leem, cadastram e editam (tom oficial protegido por trigger);
-- excluir exige songs.delete.
create policy "songs: integrantes ativos leem"
  on public.songs for select to authenticated
  using (public.is_active_member());

create policy "songs: integrantes ativos cadastram"
  on public.songs for insert to authenticated
  with check (public.is_active_member());

create policy "songs: integrantes ativos editam"
  on public.songs for update to authenticated
  using (public.is_active_member())
  with check (public.is_active_member());

create policy "songs: songs.delete remove"
  on public.songs for delete to authenticated
  using (public.has_permission('songs.delete'));

-- song_lyrics: editável por qualquer integrante ativo.
create policy "song_lyrics: integrantes ativos leem"
  on public.song_lyrics for select to authenticated
  using (public.is_active_member());

create policy "song_lyrics: integrantes ativos inserem"
  on public.song_lyrics for insert to authenticated
  with check (public.is_active_member());

create policy "song_lyrics: integrantes ativos editam"
  on public.song_lyrics for update to authenticated
  using (public.is_active_member())
  with check (public.is_active_member());

-- song_chords: todos leem; inserir qualquer ativo (nasce pending sem permissão);
-- UPDATE só com chords.edit_official.
create policy "song_chords: integrantes ativos leem"
  on public.song_chords for select to authenticated
  using (public.is_active_member());

create policy "song_chords: integrantes ativos inserem"
  on public.song_chords for insert to authenticated
  with check (public.is_active_member());

create policy "song_chords: chords.edit_official edita"
  on public.song_chords for update to authenticated
  using (public.has_permission('chords.edit_official'))
  with check (public.has_permission('chords.edit_official'));

create policy "song_chords: chords.edit_official remove"
  on public.song_chords for delete to authenticated
  using (public.has_permission('chords.edit_official'));

-- song_versions: só leitura pela API (inserção apenas via trigger).
create policy "song_versions: integrantes ativos leem"
  on public.song_versions for select to authenticated
  using (public.is_active_member());

-- song_favorites: cada um cuida dos seus.
create policy "song_favorites: o próprio lê"
  on public.song_favorites for select to authenticated
  using (user_id = (select auth.uid()) and public.is_active_member());

create policy "song_favorites: o próprio insere"
  on public.song_favorites for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_member());

create policy "song_favorites: o próprio remove"
  on public.song_favorites for delete to authenticated
  using (user_id = (select auth.uid()));

-- event_songs: todos leem; quem monta escala monta o repertório.
create policy "event_songs: integrantes ativos leem"
  on public.event_songs for select to authenticated
  using (public.is_active_member());

create policy "event_songs: schedules.manage gerencia"
  on public.event_songs for all to authenticated
  using (public.has_permission('schedules.manage'))
  with check (public.has_permission('schedules.manage'));
