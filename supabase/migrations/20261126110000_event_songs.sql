-- =============================================================================
-- REPERTÓRIO DO EVENTO: TROCAR A LISTA NUMA TRANSAÇÃO (Fase G, item 4).
--
-- set_event_songs(evento, itens) apaga e regrava a lista na ordem recebida (posições 1..N), o
-- que respeita a unicidade (event_id, position) sem "buracos" nem trocas em duas etapas.
-- Permissão: schedules.manage (a mesma das políticas de event_songs). Quem está escalado
-- recebe UM aviso "Repertório atualizado" por salvamento.
-- =============================================================================

-- Políticas de event_songs: leitura por integrantes ativos e gestão por schedules.manage já
-- existem (20261119070200). O GRANT da tabela vem de 20261120200000. Nada a criar aqui.

create or replace function public.set_event_songs(p_event_id uuid, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
  v_count integer;
begin
  if not public.has_permission('schedules.manage') then
    raise exception 'Você não tem permissão para montar o repertório.' using errcode = '42501';
  end if;
  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    raise exception 'Evento não encontrado.' using errcode = 'P0002';
  end if;
  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'Repertório inválido.' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(v_items);
  if v_count > 30 then
    raise exception 'O repertório tem no máximo 30 músicas.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_items) i
    left join public.songs s on s.id = nullif(i ->> 'song_id', '')::uuid
    where s.id is null or s.archived_at is not null
  ) then
    raise exception 'Alguma música não existe ou foi excluída do repertório.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_items) i
    where char_length(coalesce(i ->> 'key_for_event', '')) > 8
       or char_length(coalesce(i ->> 'notes', '')) > 200
  ) then
    raise exception 'Tom ou observação grande demais.' using errcode = '22023';
  end if;

  delete from public.event_songs where event_id = p_event_id;
  insert into public.event_songs (event_id, song_id, position, key_for_event, notes)
  select p_event_id,
         (i.value ->> 'song_id')::uuid,
         i.ordinality::smallint,
         nullif(btrim(coalesce(i.value ->> 'key_for_event', '')), ''),
         nullif(btrim(coalesce(i.value ->> 'notes', '')), '')
  from jsonb_array_elements(v_items) with ordinality as i (value, ordinality);

  -- Um aviso por pessoa escalada (menos quem salvou).
  insert into public.notifications (user_id, type, title, body, link)
  select distinct ea.user_id, 'event_songs_updated',
         'Repertório atualizado: ' || v_event.title,
         case v_count when 0 then 'O repertório ficou vazio.'
                      when 1 then '1 música.'
                      else v_count || ' músicas.' end,
         '/escalas/' || v_event.id || '#repertorio'
  from public.event_assignments ea
  where ea.event_id = p_event_id
    and ea.user_id is distinct from (select auth.uid());

  return v_count;
end;
$$;

revoke execute on function public.set_event_songs(uuid, jsonb) from public, anon;
grant execute on function public.set_event_songs(uuid, jsonb) to authenticated;
