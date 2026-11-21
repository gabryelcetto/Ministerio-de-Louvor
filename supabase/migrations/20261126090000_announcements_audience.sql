-- =============================================================================
-- COMUNICADOS COM PÚBLICO, DESTINATÁRIOS, LEITURAS E LEMBRETE (Fase G, itens 1 e 2).
--
-- Modelo:
--   - announcements.audience_filter (jsonb) guarda a ESCOLHA feita no formulário, para reabrir na
--     edição: {"type":"all"} | {"type":"groups","sections":[...],"function_ids":[...]}
--     | {"type":"event","event_id":"..."} | {"type":"users","user_ids":[...]}.
--   - announcement_recipients guarda QUEM recebeu (só integrantes ativos no momento da
--     publicação). É a base de "Visto por N de M", do lembrete e da leitura (RLS).
--   - announcement_reads: uma linha por pessoa que abriu o comunicado.
-- Escritas SÓ pelas RPCs save_announcement/delete_announcement (security definer): a tabela
-- announcements fica só com SELECT para authenticated. Quem decide se pode é has_permission.
-- =============================================================================

-- 1. Colunas novas --------------------------------------------------------------------------
alter table public.announcements
  add column if not exists audience_filter jsonb not null default '{"type": "all"}'::jsonb,
  add column if not exists pinned_until timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_reminder_at timestamptz;

comment on column public.announcements.audience_filter is
  'Escolha de público feita no formulário (reaberta na edição). Os destinatários reais ficam em announcement_recipients.';
comment on column public.announcements.pinned_until is
  '"Fixar no topo": até quando o comunicado aparece primeiro na lista e no Início.';

alter table public.announcements drop constraint if exists announcements_title_length;
alter table public.announcements
  add constraint announcements_title_length check (char_length(btrim(title)) between 1 and 120);
alter table public.announcements drop constraint if exists announcements_body_length;
alter table public.announcements
  add constraint announcements_body_length check (char_length(body) <= 5000);

-- 2. Destinatários e leituras ------------------------------------------------------------------
create table if not exists public.announcement_recipients (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (announcement_id, user_id)
);
create index if not exists announcement_recipients_user_idx
  on public.announcement_recipients (user_id);

create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);
create index if not exists announcement_reads_user_idx on public.announcement_reads (user_id);

alter table public.announcement_recipients enable row level security;
alter table public.announcement_reads enable row level security;

-- GRANT explícito (a nuvem não concede por padrão). Destinatários: só leitura (as RPCs gravam).
-- Leituras: cada um registra a própria (insert) e lê (select); sem update/delete.
-- (revoke antes: os privilégios padrão de 20261120200000 dão CRUD a toda tabela nova.)
revoke all on public.announcement_recipients, public.announcement_reads from anon, authenticated;
grant select on public.announcement_recipients to authenticated;
grant select, insert on public.announcement_reads to authenticated;

-- announcements: escrita só pelas RPCs.
revoke insert, update, delete on public.announcements from authenticated;

-- 3. Visibilidade (uma regra só, usada pelo RLS e pelas RPCs) -----------------------------------
create or replace function public.announcement_visible(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_member() and exists (
    select 1 from public.announcements a
    where a.id = p_id
      and (
        public.has_permission('announcements.manage')
        or (
          a.published_at <= now()
          and (
            a.audience = 'all'
            or exists (
              select 1 from public.announcement_recipients r
              where r.announcement_id = a.id and r.user_id = (select auth.uid())
            )
          )
        )
      )
  );
$$;

drop policy if exists "announcements: integrantes ativos leem publicados" on public.announcements;
drop policy if exists "announcements: announcements.manage insere" on public.announcements;
drop policy if exists "announcements: announcements.manage atualiza" on public.announcements;
drop policy if exists "announcements: announcements.manage remove" on public.announcements;
drop policy if exists "announcements: público lê" on public.announcements;

create policy "announcements: público lê"
  on public.announcements for select to authenticated
  using (
    public.is_active_member()
    and (
      public.has_permission('announcements.manage')
      or (
        published_at <= now()
        and (
          audience = 'all'
          or exists (
            select 1 from public.announcement_recipients r
            where r.announcement_id = id and r.user_id = (select auth.uid())
          )
        )
      )
    )
  );

drop policy if exists "announcement_recipients: o próprio ou quem gerencia lê"
  on public.announcement_recipients;
create policy "announcement_recipients: o próprio ou quem gerencia lê"
  on public.announcement_recipients for select to authenticated
  using (
    public.is_active_member()
    and (user_id = (select auth.uid()) or public.has_permission('announcements.manage'))
  );

drop policy if exists "announcement_reads: o próprio ou quem gerencia lê" on public.announcement_reads;
create policy "announcement_reads: o próprio ou quem gerencia lê"
  on public.announcement_reads for select to authenticated
  using (
    public.is_active_member()
    and (user_id = (select auth.uid()) or public.has_permission('announcements.manage'))
  );

drop policy if exists "announcement_reads: cada um registra a própria leitura"
  on public.announcement_reads;
create policy "announcement_reads: cada um registra a própria leitura"
  on public.announcement_reads for insert to authenticated
  with check (user_id = (select auth.uid()) and public.announcement_visible(announcement_id));

-- 4. Público → destinatários ---------------------------------------------------------------------
-- Uso interno (sem EXECUTE para authenticated): só integrantes ATIVOS e já liberados.
create or replace function public.announcement_audience(p_filter jsonb)
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_type text := coalesce(p_filter ->> 'type', 'all');
  v_sections text[] := coalesce(
    (select array_agg(x) from jsonb_array_elements_text(coalesce(p_filter -> 'sections', '[]')) x),
    '{}');
  v_functions smallint[] := coalesce(
    (select array_agg(x::smallint) from jsonb_array_elements_text(coalesce(p_filter -> 'function_ids', '[]')) x),
    '{}');
  v_users uuid[] := coalesce(
    (select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p_filter -> 'user_ids', '[]')) x),
    '{}');
  v_event uuid := nullif(p_filter ->> 'event_id', '')::uuid;
begin
  if v_type not in ('all', 'groups', 'event', 'users') then
    raise exception 'Público inválido.' using errcode = '22023';
  end if;
  return query
  select p.id
  from public.profiles p
  where p.status = 'active'
    and not p.must_change_password
    and (
      v_type = 'all'
      or (v_type = 'groups' and exists (
        select 1 from public.member_functions mf
        join public.ministry_functions f on f.id = mf.function_id
        where mf.user_id = p.id
          and (f.section = any (v_sections) or f.id = any (v_functions))
      ))
      or (v_type = 'event' and exists (
        select 1 from public.event_assignments ea
        where ea.event_id = v_event and ea.user_id = p.id
      ))
      or (v_type = 'users' and p.id = any (v_users))
    );
end;
$$;

revoke execute on function public.announcement_audience(jsonb) from public, anon, authenticated;

-- "Vai para N pessoas" (antes de publicar).
create or replace function public.preview_announcement_audience(p_filter jsonb)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('announcements.manage') then
    raise exception 'Você não tem permissão para publicar comunicados.' using errcode = '42501';
  end if;
  return (select count(*)::int from public.announcement_audience(p_filter));
end;
$$;

-- 5. Publicar / editar ----------------------------------------------------------------------------
create or replace function public.save_announcement(
  p_id uuid,
  p_title text,
  p_body text,
  p_filter jsonb,
  p_pinned_until timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_filter jsonb := coalesce(p_filter, '{"type": "all"}'::jsonb);
  v_type text := coalesce(v_filter ->> 'type', 'all');
  v_audience text;
  v_id uuid;
  v_old_filter jsonb;
  v_new uuid[];
  v_old uuid[] := '{}';
  v_notify uuid[];
begin
  if not public.has_permission('announcements.manage') then
    raise exception 'Você não tem permissão para publicar comunicados.' using errcode = '42501';
  end if;
  if char_length(v_title) < 1 or char_length(v_title) > 120 then
    raise exception 'Informe o título (até 120 caracteres).' using errcode = '22023';
  end if;
  if char_length(v_body) > 5000 then
    raise exception 'O texto passou de 5.000 caracteres.' using errcode = '22023';
  end if;
  v_audience := case v_type
    when 'all' then 'all' when 'groups' then 'function' when 'event' then 'event' when 'users' then 'users'
  end;
  if v_audience is null then
    raise exception 'Público inválido.' using errcode = '22023';
  end if;

  select coalesce(array_agg(u), '{}') into v_new from public.announcement_audience(v_filter) u;
  if v_type <> 'all' and cardinality(v_new) = 0 then
    raise exception 'Ninguém recebe este comunicado: escolha pelo menos uma pessoa ativa.'
      using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.announcements (title, body, audience, audience_filter, pinned_until, created_by)
    values (v_title, v_body, v_audience, v_filter, p_pinned_until, v_me)
    returning id into v_id;
    v_notify := v_new;
  else
    select a.audience_filter into v_old_filter from public.announcements a where a.id = p_id for update;
    if not found then
      raise exception 'Comunicado não encontrado.' using errcode = 'P0002';
    end if;
    v_id := p_id;
    select coalesce(array_agg(r.user_id), '{}') into v_old
    from public.announcement_recipients r where r.announcement_id = v_id;
    update public.announcements set
      title = v_title, body = v_body, audience = v_audience, audience_filter = v_filter,
      pinned_until = p_pinned_until, updated_at = now()
    where id = v_id;
    delete from public.announcement_recipients r
    where r.announcement_id = v_id and not (r.user_id = any (v_new));
    -- Edição: só avisa se o público mudou, e só quem entrou agora.
    if v_old_filter is distinct from v_filter then
      select coalesce(array_agg(u), '{}') into v_notify from unnest(v_new) u where not (u = any (v_old));
    else
      v_notify := '{}';
    end if;
  end if;

  insert into public.announcement_recipients (announcement_id, user_id)
  select v_id, u from unnest(v_new) u
  on conflict do nothing;

  insert into public.notifications (user_id, type, title, body, link)
  select u, 'announcement', 'Novo comunicado: ' || v_title, left(v_body, 140), '/comunicados/' || v_id
  from unnest(v_notify) u
  where u is distinct from v_me;

  return v_id;
end;
$$;

create or replace function public.delete_announcement(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('announcements.manage') then
    raise exception 'Você não tem permissão para excluir comunicados.' using errcode = '42501';
  end if;
  delete from public.announcements where id = p_id;
  if not found then
    raise exception 'Comunicado não encontrado.' using errcode = 'P0002';
  end if;
  delete from public.notifications where link = '/comunicados/' || p_id;
end;
$$;

-- 6. Leitura ------------------------------------------------------------------------------------
-- Abrir o detalhe: registra a leitura e marca como lida a notificação do comunicado.
create or replace function public.mark_announcement_read(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if not public.announcement_visible(p_id) then
    raise exception 'Comunicado não encontrado.' using errcode = 'P0002';
  end if;
  insert into public.announcement_reads (announcement_id, user_id) values (p_id, v_me)
  on conflict do nothing;
  update public.notifications set read_at = now()
  where user_id = v_me and read_at is null and link = '/comunicados/' || p_id;
end;
$$;

-- "Visto por N de M": quem recebeu e quando leu (só quem gerencia comunicados).
create or replace function public.get_announcement_audience_status(p_id uuid)
returns table (user_id uuid, full_name text, display_name text, read_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('announcements.manage') then
    raise exception 'Você não tem permissão para ver quem leu.' using errcode = '42501';
  end if;
  return query
  select r.user_id, p.full_name, p.display_name, rd.read_at
  from public.announcement_recipients r
  join public.profiles p on p.id = r.user_id
  left join public.announcement_reads rd on rd.announcement_id = r.announcement_id and rd.user_id = r.user_id
  where r.announcement_id = p_id
  order by rd.read_at is null desc, coalesce(nullif(p.display_name, ''), p.full_name);
end;
$$;

-- "Lembrar quem não viu": no máximo 1 lembrete por dia (horário de Brasília) por comunicado.
create or replace function public.remind_announcement(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.announcements%rowtype;
  v_count integer;
begin
  if not public.has_permission('announcements.manage') then
    raise exception 'Você não tem permissão para enviar lembretes.' using errcode = '42501';
  end if;
  select * into v_a from public.announcements where id = p_id for update;
  if not found then
    raise exception 'Comunicado não encontrado.' using errcode = 'P0002';
  end if;
  if v_a.last_reminder_at is not null
     and (v_a.last_reminder_at at time zone 'America/Sao_Paulo')::date
         = (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Já foi enviado um lembrete hoje. Tente de novo amanhã.' using errcode = 'P0001';
  end if;

  insert into public.notifications (user_id, type, title, body, link)
  select r.user_id, 'announcement_reminder', 'Lembrete: ' || v_a.title, left(v_a.body, 140),
         '/comunicados/' || v_a.id
  from public.announcement_recipients r
  join public.profiles p on p.id = r.user_id and p.status = 'active'
  where r.announcement_id = v_a.id
    and not exists (
      select 1 from public.announcement_reads rd
      where rd.announcement_id = v_a.id and rd.user_id = r.user_id
    );
  get diagnostics v_count = row_count;

  update public.announcements set last_reminder_at = now() where id = v_a.id;
  return v_count;
end;
$$;

-- 7. Início: comunicados fixados primeiro (o RLS de announcements já respeita o público) ----------
create or replace function public.get_dashboard()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with next_service as (
    select e.* from public.events e
    where e.type = 'culto' and e.status = 'scheduled' and e.starts_at >= now()
    order by e.starts_at limit 1
  ),
  next_rehearsal as (
    select e.* from public.events e
    where e.type = 'ensaio' and e.status = 'scheduled' and e.starts_at >= now()
    order by e.starts_at limit 1
  )
  select jsonb_build_object(
    'next_service', (select to_jsonb(ns) from next_service ns),
    'next_rehearsal', (select to_jsonb(nr) from next_rehearsal nr),
    'my_assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'assignment_id', ea.id,
               'event_id', e.id,
               'event_title', e.title,
               'event_type', e.type,
               'starts_at', e.starts_at,
               'location', e.location,
               'function', mf.name
             ) order by e.starts_at)
      from public.event_assignments ea
      join public.events e on e.id = ea.event_id
      join public.ministry_functions mf on mf.id = ea.function_id
      where ea.user_id = (select auth.uid())
        and e.status = 'scheduled'
        and e.starts_at >= now()
    ), '[]'::jsonb),
    'next_service_songs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'song_id', s.id,
               'title', s.title,
               'artist', s.artist,
               'position', es.position,
               'key', coalesce(es.key_for_event, s.official_key, s.original_key)
             ) order by es.position)
      from public.event_songs es
      join public.songs s on s.id = es.song_id
      where es.event_id = (select id from next_service)
    ), '[]'::jsonb),
    'recent_announcements', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.pinned desc, a.published_at desc)
      from (
        select id, title, body, published_at,
               coalesce(pinned_until > now(), false) as pinned
        from public.announcements
        where published_at <= now()
        order by coalesce(pinned_until > now(), false) desc, published_at desc
        limit 3
      ) a
    ), '[]'::jsonb),
    'unread_notifications', (
      select count(*) from public.notifications n
      where n.user_id = (select auth.uid()) and n.read_at is null
    )
  );
$$;

-- 8. EXECUTE só para usuários logados ---------------------------------------------------------
revoke execute on function public.announcement_visible(uuid) from public, anon;
revoke execute on function public.preview_announcement_audience(jsonb) from public, anon;
revoke execute on function public.save_announcement(uuid, text, text, jsonb, timestamptz) from public, anon;
revoke execute on function public.delete_announcement(uuid) from public, anon;
revoke execute on function public.mark_announcement_read(uuid) from public, anon;
revoke execute on function public.get_announcement_audience_status(uuid) from public, anon;
revoke execute on function public.remind_announcement(uuid) from public, anon;
revoke execute on function public.get_dashboard() from public, anon;
grant execute on function public.announcement_visible(uuid) to authenticated;
grant execute on function public.preview_announcement_audience(jsonb) to authenticated;
grant execute on function public.save_announcement(uuid, text, text, jsonb, timestamptz) to authenticated;
grant execute on function public.delete_announcement(uuid) to authenticated;
grant execute on function public.mark_announcement_read(uuid) to authenticated;
grant execute on function public.get_announcement_audience_status(uuid) to authenticated;
grant execute on function public.remind_announcement(uuid) to authenticated;
grant execute on function public.get_dashboard() to authenticated;
