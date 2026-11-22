-- =============================================================================
-- LISTAS LONGAS: "CARREGAR MAIS" (Fase G, item 13; resolve a pendência 13).
--
-- Notificações, Comunicados e Histórico da música paginam pela API (range). A Atividade
-- recente vem de uma RPC: ganha p_offset (troca a assinatura; a antiga sai).
-- =============================================================================

drop function if exists public.get_recent_activity(uuid, uuid, integer);

create or replace function public.get_recent_activity(
  p_actor uuid default null,
  p_song uuid default null,
  p_limit integer default 100,
  p_offset integer default 0
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
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke execute on function public.get_recent_activity(uuid, uuid, integer, integer) from public, anon;
grant execute on function public.get_recent_activity(uuid, uuid, integer, integer) to authenticated;
