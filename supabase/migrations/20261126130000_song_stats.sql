-- =============================================================================
-- MÚSICA E REPERTÓRIO: "TOCADA EM", CONTAGENS E ORDENAÇÕES (Fase G, item 8).
--
-- As contagens são feitas no banco (o celular não baixa todos os eventos):
--   - get_song_stats(): para cada música, quantas vezes entrou num evento que já aconteceu e
--     a última data (lista do repertório: "há 3 semanas", "Mais tocadas", "Há mais tempo sem
--     tocar");
--   - get_song_plays(música): total + as últimas N vezes (seção "Tocada em").
-- "Tocada" = evento não cancelado que já começou. Security invoker: o RLS de events e
-- event_songs continua valendo. Favoritos: a tabela e as políticas já existem
-- (song_favorites, 20261119070200); o pgTAP desta fase cobre o RLS.
-- =============================================================================

create or replace function public.get_song_stats()
returns table (song_id uuid, play_count integer, last_played_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select es.song_id, count(distinct e.id)::integer, max(e.starts_at)
  from public.event_songs es
  join public.events e on e.id = es.event_id
  where e.status = 'scheduled' and e.starts_at <= now()
  group by es.song_id;
$$;

create or replace function public.get_song_plays(p_song_id uuid, p_limit integer default 5)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with plays as (
    select distinct on (e.id) e.id, e.title, e.type, e.starts_at,
           coalesce(es.key_for_event, s.official_key, s.original_key) as key
    from public.event_songs es
    join public.events e on e.id = es.event_id
    join public.songs s on s.id = es.song_id
    where es.song_id = p_song_id and e.status = 'scheduled' and e.starts_at <= now()
    order by e.id, es.position
  )
  select jsonb_build_object(
    'total', (select count(*) from plays),
    'recent', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.starts_at desc)
      from (
        select * from plays order by starts_at desc
        limit least(greatest(coalesce(p_limit, 5), 1), 20)
      ) r
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.get_song_stats() from public, anon;
revoke execute on function public.get_song_plays(uuid, integer) from public, anon;
grant execute on function public.get_song_stats() to authenticated;
grant execute on function public.get_song_plays(uuid, integer) to authenticated;
