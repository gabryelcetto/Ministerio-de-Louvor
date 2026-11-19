-- =============================================================================
-- 4/4 COMUNICAÇÃO: comunicados, notificações (geradas por trigger) e dashboard.
-- =============================================================================

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  published_at timestamptz not null default now(),
  audience text not null default 'all' check (audience in ('all', 'function', 'event', 'users')),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index announcements_published_idx on public.announcements (published_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.announcements enable row level security;
alter table public.notifications enable row level security;

-- announcements: ativos leem os já publicados; announcements.manage vê tudo e gerencia.
create policy "announcements: integrantes ativos leem publicados"
  on public.announcements for select to authenticated
  using (
    public.is_active_member()
    and (published_at <= now() or public.has_permission('announcements.manage'))
  );

create policy "announcements: announcements.manage insere"
  on public.announcements for insert to authenticated
  with check (public.has_permission('announcements.manage'));

create policy "announcements: announcements.manage atualiza"
  on public.announcements for update to authenticated
  using (public.has_permission('announcements.manage'))
  with check (public.has_permission('announcements.manage'));

create policy "announcements: announcements.manage remove"
  on public.announcements for delete to authenticated
  using (public.has_permission('announcements.manage'));

-- notifications: cada usuário só lê e marca como lida as SUAS. Inserção só por trigger.
revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "notifications: o próprio lê"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and public.is_active_member());

create policy "notifications: o próprio marca como lida"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()) and public.is_active_member())
  with check (user_id = (select auth.uid()));

-- Triggers de notificação -------------------------------------------------------------
create or replace function public.notify_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_function text;
begin
  if tg_op = 'INSERT' then
    select * into v_event from public.events where id = new.event_id;
    select name into v_function from public.ministry_functions where id = new.function_id;
    insert into public.notifications (user_id, type, title, body, link)
    values (
      new.user_id,
      'assignment_added',
      'Você foi escalado(a): ' || v_event.title,
      coalesce(v_function, 'Função') || ' — '
        || to_char(v_event.starts_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'),
      '/escalas/' || v_event.id
    );
    return new;
  end if;

  select * into v_event from public.events where id = old.event_id;
  if found then
    insert into public.notifications (user_id, type, title, body, link)
    values (
      old.user_id,
      'assignment_removed',
      'Você saiu da escala: ' || v_event.title,
      to_char(v_event.starts_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'),
      '/escalas/' || v_event.id
    );
  end if;
  return old;
end;
$$;

create trigger event_assignments_notify
after insert or delete on public.event_assignments
for each row execute function public.notify_assignment_change();

create or replace function public.notify_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_title text;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    v_type := 'event_cancelled';
    v_title := 'Evento cancelado: ' || new.title;
  elsif new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at
     or new.location is distinct from old.location
     or new.title is distinct from old.title then
    v_type := 'event_updated';
    v_title := 'Evento alterado: ' || new.title;
  else
    return new;
  end if;

  insert into public.notifications (user_id, type, title, body, link)
  select distinct ea.user_id, v_type, v_title,
         to_char(new.starts_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI')
           || coalesce(' — ' || new.location, ''),
         '/escalas/' || new.id
  from public.event_assignments ea
  where ea.event_id = new.id;
  return new;
end;
$$;

create trigger events_notify_change
after update on public.events
for each row execute function public.notify_event_change();

-- Dashboard: tudo que a tela inicial precisa numa chamada só.
-- security invoker → o RLS de cada tabela continua valendo.
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
      select jsonb_agg(to_jsonb(a) order by a.published_at desc)
      from (
        select id, title, body, published_at from public.announcements
        where published_at <= now()
        order by published_at desc limit 3
      ) a
    ), '[]'::jsonb),
    'unread_notifications', (
      select count(*) from public.notifications n
      where n.user_id = (select auth.uid()) and n.read_at is null
    )
  );
$$;

revoke execute on function public.get_dashboard() from anon, public;
grant execute on function public.get_dashboard() to authenticated;
