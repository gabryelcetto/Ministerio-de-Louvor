-- =============================================================================
-- ADVOP: perfis admin/member, grupos (vocal/instrumental), novas permissões padrão,
-- cadastro/edição/arquivamento de música e "Atividade recente".
--
-- O seed NÃO roda de novo na nuvem: tudo que muda dados de configuração (role_permissions,
-- perfis, cifras pendentes) está aqui, de forma idempotente.
-- =============================================================================

-- 1. Perfis: só admin e member na prática ---------------------------------------------------
-- O valor 'leader' continua no enum (remover valor de enum exige recriar o tipo), mas ninguém
-- usa mais: quem era líder vira integrante e uma CHECK impede voltar a usar.
update public.profiles set access_role = 'member' where access_role = 'leader';

alter table public.profiles drop constraint if exists profiles_access_role_not_leader;
alter table public.profiles
  add constraint profiles_access_role_not_leader check (access_role <> 'leader');

-- 2. Grupos do ministério -------------------------------------------------------------------
alter table public.ministry_functions
  add column if not exists section text not null default 'instrumental';
alter table public.ministry_functions drop constraint if exists ministry_functions_section_check;
alter table public.ministry_functions
  add constraint ministry_functions_section_check check (section in ('vocal', 'instrumental'));

update public.ministry_functions set section = 'vocal'
where name in ('Vocal principal', 'Backing vocal');

comment on column public.ministry_functions.section is
  'vocal (cantores) ou instrumental: só para selos e filtros; NÃO define permissões.';
-- (GRANT: a tabela já tem select/insert/update/delete para authenticated em nível de tabela,
--  que vale para colunas novas; nada para anon.)

-- 3. Permissões ------------------------------------------------------------------------------
-- Catálogo completo aqui (e não só no seed): num banco novo as migrations rodam ANTES do seed,
-- e role_permissions tem chave estrangeira para permissions.
insert into public.permissions (key, description) values
  ('schedules.manage', 'Criar e editar escalas e o repertório dos eventos'),
  ('events.manage', 'Criar, editar e cancelar eventos da agenda'),
  ('announcements.manage', 'Publicar e editar comunicados'),
  ('songs.delete', 'Excluir músicas do repertório'),
  ('chords.edit_official', 'Editar e aprovar a cifra oficial'),
  ('songs.set_official_key', 'Definir o tom oficial da música'),
  ('members.view_contacts', 'Ver telefone dos integrantes'),
  ('members.manage', 'Gerenciar integrantes, perfis e funções'),
  ('permissions.manage', 'Gerenciar permissões por perfil e por usuário'),
  ('history.restore', 'Restaurar versões antigas de letra, cifra e tom'),
  ('songs.manage', 'Cadastrar música e editar os dados da música'),
  ('history.view_all', 'Ver a atividade recente de todo o repertório')
on conflict (key) do nothing;

-- Padrão por perfil (substitui o padrão antigo; exceções individuais em user_permissions ficam).
delete from public.role_permissions where role in ('member', 'leader');
insert into public.role_permissions (role, permission_key) values
  ('member', 'chords.edit_official'),
  ('member', 'songs.set_official_key'),
  ('member', 'songs.manage')
on conflict do nothing;
-- admin: todas as permissões (inclusive as novas)
insert into public.role_permissions (role, permission_key)
select 'admin', key from public.permissions
on conflict do nothing;

-- 4. Cifra nova entra direto como oficial (fim do fluxo de "pendente") ----------------------
drop trigger if exists song_chords_guard_insert on public.song_chords;
drop function if exists public.guard_song_chords_insert();
update public.song_chords set review_status = 'official' where review_status = 'pending';

-- 5. Música: cadastrar/editar dados (songs.manage), arquivar (songs.delete) -----------------
drop policy if exists "songs: integrantes ativos cadastram" on public.songs;
drop policy if exists "songs: integrantes ativos editam" on public.songs;
drop policy if exists "songs: songs.manage cadastra" on public.songs;
drop policy if exists "songs: quem pode alterar algo edita" on public.songs;

create policy "songs: songs.manage cadastra"
  on public.songs for insert to authenticated
  with check (public.has_permission('songs.manage'));

-- O UPDATE passa se a pessoa pode mexer em ALGUMA parte da música; o trigger abaixo confere
-- coluna por coluna (dados, tom oficial, arquivamento).
create policy "songs: quem pode alterar algo edita"
  on public.songs for update to authenticated
  using (
    public.has_permission('songs.manage')
    or public.has_permission('songs.set_official_key')
    or public.has_permission('songs.delete')
  )
  with check (
    public.has_permission('songs.manage')
    or public.has_permission('songs.set_official_key')
    or public.has_permission('songs.delete')
  );

create or replace function public.guard_song_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new; -- contexto administrativo (seed, migrations, SQL Editor)
  end if;
  if (new.title, new.artist, new.category, new.original_key, new.media_url, new.notes)
     is distinct from
     (old.title, old.artist, old.category, old.original_key, old.media_url, old.notes)
     and not public.has_permission('songs.manage') then
    raise exception 'Sem permissão para editar os dados da música.' using errcode = '42501';
  end if;
  if new.archived_at is distinct from old.archived_at and not public.has_permission('songs.delete') then
    raise exception 'Sem permissão para arquivar músicas.' using errcode = '42501';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'Não é permitido alterar quem cadastrou a música.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists songs_guard_changes on public.songs;
create trigger songs_guard_changes
before update on public.songs
for each row execute function public.guard_song_changes();

-- Arquivar/desarquivar fica registrado (entra na Atividade recente).
create or replace function public.log_song_archive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.archived_at is distinct from old.archived_at then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (
      (select auth.uid()),
      case when new.archived_at is null then 'unarchive_song' else 'archive_song' end,
      'song', new.id::text, jsonb_build_object('title', new.title)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists songs_log_archive on public.songs;
create trigger songs_log_archive
after update on public.songs
for each row execute function public.log_song_archive();

-- Cadastrar música com letra e cifra numa transação só (security invoker: RLS e triggers
-- valem; letra e cifra entram no histórico como "create").
create or replace function public.create_song(
  p_title text,
  p_artist text,
  p_category text,
  p_original_key text,
  p_official_key text,
  p_media_url text,
  p_notes text,
  p_lyrics text,
  p_chords text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
begin
  if char_length(v_title) < 1 or char_length(v_title) > 200 then
    raise exception 'Informe o título da música (até 200 caracteres).' using errcode = '22023';
  end if;
  insert into public.songs (title, artist, category, original_key, official_key, media_url, notes)
  values (
    v_title,
    nullif(btrim(coalesce(p_artist, '')), ''),
    nullif(btrim(coalesce(p_category, '')), ''),
    nullif(btrim(coalesce(p_original_key, '')), ''),
    nullif(btrim(coalesce(p_official_key, '')), ''),
    nullif(btrim(coalesce(p_media_url, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning id into v_id;

  if nullif(btrim(coalesce(p_lyrics, '')), '') is not null then
    insert into public.song_lyrics (song_id, content) values (v_id, p_lyrics);
  end if;
  if nullif(btrim(coalesce(p_chords, '')), '') is not null then
    insert into public.song_chords (song_id, content) values (v_id, p_chords);
  end if;
  return v_id;
end;
$$;

revoke execute on function public.create_song(text, text, text, text, text, text, text, text, text)
  from anon, public;
grant execute on function public.create_song(text, text, text, text, text, text, text, text, text)
  to authenticated;

-- 6. Atividade recente (só history.view_all) --------------------------------------------------
-- O histórico de CADA música continua legível por todos (song_versions). O que é restrito é a
-- visão geral, que junta song_versions + audit_logs (este só o admin lê).
create or replace function public.get_recent_activity(
  p_actor uuid default null,
  p_song uuid default null,
  p_limit integer default 100
)
returns table (
  kind text,
  occurred_at timestamptz,
  actor_id uuid,
  actor_name text,
  song_id uuid,
  song_title text,
  field text,
  change_type text,
  action text,
  version_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.has_permission('history.view_all') then
    raise exception 'Sem permissão para ver a atividade de todo o repertório.' using errcode = '42501';
  end if;

  return query
  select * from (
    select
      'version'::text,
      v.changed_at,
      v.changed_by,
      coalesce(nullif(p.display_name, ''), p.full_name),
      v.song_id,
      s.title,
      v.field,
      v.change_type,
      null::text,
      v.id
    from public.song_versions v
    join public.songs s on s.id = v.song_id
    left join public.profiles p on p.id = v.changed_by
    where (p_actor is null or v.changed_by = p_actor)
      and (p_song is null or v.song_id = p_song)

    union all

    select
      'audit'::text,
      a.created_at,
      a.actor_id,
      coalesce(nullif(p.display_name, ''), p.full_name),
      s.id,
      coalesce(s.title, a.details ->> 'title'),
      a.details ->> 'field',
      null::text,
      a.action,
      nullif(a.details ->> 'version_id', '')::uuid
    from public.audit_logs a
    left join public.songs s on a.entity = 'song' and s.id::text = a.entity_id
    left join public.profiles p on p.id = a.actor_id
    where a.entity = 'song'
      and (p_actor is null or a.actor_id = p_actor)
      and (p_song is null or a.entity_id = p_song::text)
  ) as feed
  order by 2 desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

revoke execute on function public.get_recent_activity(uuid, uuid, integer) from anon, public;
grant execute on function public.get_recent_activity(uuid, uuid, integer) to authenticated;

-- 7. Cadastro de integrante: sem 'leader' ----------------------------------------------------
create or replace function public.setup_new_member(
  p_user_id uuid,
  p_full_name text,
  p_display_name text,
  p_access_role public.access_role,
  p_function_ids smallint[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created_at timestamptz;
  v_last_sign_in timestamptz;
  v_name text := btrim(coalesce(p_full_name, ''));
begin
  if not public.has_permission('members.manage') then
    raise exception 'Você não tem permissão para cadastrar integrantes.' using errcode = '42501';
  end if;
  if p_access_role = 'leader' then
    raise exception 'Perfil inválido: use integrante ou administrador.' using errcode = '22023';
  end if;
  if coalesce(p_access_role, 'member') <> 'member' and not public.has_permission('permissions.manage') then
    raise exception 'Só quem gerencia permissões pode cadastrar administradores.'
      using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Informe o nome completo (de 2 a 120 caracteres).' using errcode = '22023';
  end if;

  select created_at, last_sign_in_at into v_created_at, v_last_sign_in
  from auth.users where id = p_user_id;
  if not found then
    raise exception 'Conta não encontrada.' using errcode = 'P0002';
  end if;
  if v_last_sign_in is not null or v_created_at < now() - interval '10 minutes' then
    raise exception 'Só é possível configurar contas recém-criadas.' using errcode = '42501';
  end if;

  insert into public.profiles (id, full_name) values (p_user_id, v_name)
  on conflict (id) do nothing;

  update public.profiles set
    full_name = v_name,
    display_name = nullif(btrim(coalesce(p_display_name, '')), ''),
    access_role = coalesce(p_access_role, 'member'),
    status = 'active',
    must_change_password = true
  where id = p_user_id;

  insert into public.member_functions (user_id, function_id)
  select p_user_id, f from unnest(coalesce(p_function_ids, '{}')) as f
  on conflict do nothing;

  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (
    (select auth.uid()), 'invite_member', 'profile', p_user_id::text,
    jsonb_build_object('access_role', coalesce(p_access_role, 'member'), 'function_ids', p_function_ids)
  );
end;
$$;
