-- =============================================================================
-- ESCALAS: VISÃO DO ADMIN (Fase G, item 6).
--
-- get_dashboard ganha "attention" (até 3 eventos dos próximos 14 dias com pendência) e
-- "attention_total", só para quem tem schedules.manage (para os demais: vazio e 0).
-- Pendência = sem equipe, ou culto sem repertório (as recusas entram na Fase H).
-- A lista "Todas" das escalas usa as tabelas (RLS de events/event_assignments/event_songs).
-- =============================================================================

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
  ),
  -- Mesmas regras de src/features/escalas/pending.ts: sem equipe; culto sem repertório.
  pending_events as (
    select e.id, e.title, e.type, e.starts_at,
           not exists (select 1 from public.event_assignments ea where ea.event_id = e.id) as no_team,
           (e.type = 'culto'
             and not exists (select 1 from public.event_songs es where es.event_id = e.id)) as no_songs
    from public.events e
    where e.status = 'scheduled'
      and e.starts_at >= now()
      and e.starts_at < now() + interval '14 days'
      and (
        not exists (select 1 from public.event_assignments ea where ea.event_id = e.id)
        or (e.type = 'culto'
            and not exists (select 1 from public.event_songs es where es.event_id = e.id))
      )
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
    ),
    -- "Precisa de atenção" (só para quem monta escala): próximos 14 dias com pendência.
    'attention', case when public.has_permission('schedules.manage') then coalesce((
      select jsonb_agg(to_jsonb(p) order by p.starts_at)
      from (
        select * from pending_events order by starts_at limit 3
      ) p
    ), '[]'::jsonb) else '[]'::jsonb end,
    'attention_total', case when public.has_permission('schedules.manage')
      then (select count(*) from pending_events) else 0 end
  );
$$;

revoke execute on function public.get_dashboard() from public, anon;
grant execute on function public.get_dashboard() to authenticated;
