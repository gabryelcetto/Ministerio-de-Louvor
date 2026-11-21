-- =============================================================================
-- EVENTOS: CRIAR COM EQUIPE NUMA TRANSAÇÃO, REPETIR TODA SEMANA E DUPLICAR (Fase G, item 3).
--
-- Resolve a pendência 17 (evento + equipe eram duas gravações): create_event_with_team grava o
-- evento (ou N eventos semanais) e a equipe numa transação só. Se algo falhar, nada fica pela
-- metade. Permissões no banco: events.manage para criar; schedules.manage para escalar.
-- Repetição: 1 a 12 semanas, mesma equipe e SEM repertório. Cada pessoa recebe UM aviso
-- ("Você foi escalado(a) em N eventos") em vez de N avisos.
-- =============================================================================

-- 1. Aviso de escala: o trigger pode ser silenciado dentro de uma gravação em lote ------------
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
  -- Gravação em lote (create_event_with_team com repetição): a RPC manda um aviso resumido.
  if coalesce(current_setting('app.bulk_assign', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

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

-- 2. Criar evento(s) com equipe -------------------------------------------------------------------
-- p_assignments: [{"user_id": "...", "function_id": 3, "notes": "..."}] (pode ser vazio).
-- Devolve os ids criados, do primeiro ao último.
create or replace function public.create_event_with_team(
  p_type text,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_location text,
  p_notes text,
  p_assignments jsonb default '[]'::jsonb,
  p_repeat_weeks integer default 1
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_weeks integer := coalesce(p_repeat_weeks, 1);
  v_assignments jsonb := coalesce(p_assignments, '[]'::jsonb);
  v_ids uuid[] := '{}';
  v_id uuid;
  v_local_start timestamp;
  v_duration interval;
  v_start timestamptz;
  i integer;
begin
  if not public.has_permission('events.manage') then
    raise exception 'Você não tem permissão para criar eventos.' using errcode = '42501';
  end if;
  if jsonb_typeof(v_assignments) <> 'array' then
    raise exception 'Equipe inválida.' using errcode = '22023';
  end if;
  if jsonb_array_length(v_assignments) > 0 and not public.has_permission('schedules.manage') then
    raise exception 'Você não tem permissão para montar escalas.' using errcode = '42501';
  end if;
  if p_type not in ('culto', 'ensaio', 'evento') then
    raise exception 'Tipo de evento inválido.' using errcode = '22023';
  end if;
  if char_length(v_title) < 1 or char_length(v_title) > 120 then
    raise exception 'Informe o título (até 120 caracteres).' using errcode = '22023';
  end if;
  if p_starts_at is null then
    raise exception 'Informe data e hora de início.' using errcode = '22023';
  end if;
  if p_ends_at is not null and p_ends_at < p_starts_at then
    raise exception 'O término precisa ser depois do início.' using errcode = '22023';
  end if;
  if v_weeks < 1 or v_weeks > 12 then
    raise exception 'Repita de 1 a 12 semanas.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_assignments) a
    left join public.profiles p on p.id = nullif(a ->> 'user_id', '')::uuid
    where p.id is null or p.status <> 'active'
  ) then
    raise exception 'Só integrantes ativos podem ser escalados.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_assignments) a
    left join public.ministry_functions f on f.id = nullif(a ->> 'function_id', '')::smallint
    where f.id is null
  ) then
    raise exception 'Escolha a função de cada pessoa.' using errcode = '22023';
  end if;

  -- Semana a semana no horário de Brasília (o mesmo "19h" toda semana).
  v_local_start := p_starts_at at time zone 'America/Sao_Paulo';
  v_duration := p_ends_at - p_starts_at;

  if v_weeks > 1 then
    perform set_config('app.bulk_assign', 'on', true);
  end if;

  for i in 0 .. v_weeks - 1 loop
    v_start := (v_local_start + make_interval(days => 7 * i)) at time zone 'America/Sao_Paulo';
    insert into public.events (type, title, starts_at, ends_at, location, notes, created_by)
    values (
      p_type, v_title, v_start,
      case when v_duration is null then null else v_start + v_duration end,
      nullif(btrim(coalesce(p_location, '')), ''),
      nullif(btrim(coalesce(p_notes, '')), ''),
      (select auth.uid())
    )
    returning id into v_id;
    v_ids := v_ids || v_id;

    insert into public.event_assignments (event_id, user_id, function_id, notes)
    select v_id, (a ->> 'user_id')::uuid, (a ->> 'function_id')::smallint,
           nullif(btrim(coalesce(a ->> 'notes', '')), '')
    from jsonb_array_elements(v_assignments) a
    on conflict (event_id, user_id, function_id) do nothing;
  end loop;

  if v_weeks > 1 then
    perform set_config('app.bulk_assign', 'off', true);
    -- Um aviso por pessoa, com a quantidade de eventos.
    insert into public.notifications (user_id, type, title, body, link)
    select distinct (a ->> 'user_id')::uuid,
           'assignment_added',
           'Você foi escalado(a) em ' || v_weeks || ' eventos: ' || v_title,
           'Toda semana a partir de '
             || to_char(p_starts_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'),
           '/escalas'
    from jsonb_array_elements(v_assignments) a;
  end if;

  return v_ids;
end;
$$;

-- 3. Duplicar evento (nova data): copia dados, equipe e repertório ---------------------------------
create or replace function public.duplicate_event(p_event_id uuid, p_starts_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_src public.events%rowtype;
  v_id uuid;
begin
  if not public.has_permission('events.manage') then
    raise exception 'Você não tem permissão para criar eventos.' using errcode = '42501';
  end if;
  if p_starts_at is null then
    raise exception 'Informe a nova data.' using errcode = '22023';
  end if;
  select * into v_src from public.events where id = p_event_id;
  if not found then
    raise exception 'Evento não encontrado.' using errcode = 'P0002';
  end if;

  insert into public.events (type, title, starts_at, ends_at, location, notes, created_by)
  values (
    v_src.type, v_src.title, p_starts_at,
    case when v_src.ends_at is null then null else p_starts_at + (v_src.ends_at - v_src.starts_at) end,
    v_src.location, v_src.notes, (select auth.uid())
  )
  returning id into v_id;

  -- Equipe e repertório só para quem monta escala (sem a permissão, sai só o evento).
  if public.has_permission('schedules.manage') then
    insert into public.event_assignments (event_id, user_id, function_id, notes)
    select v_id, ea.user_id, ea.function_id, ea.notes
    from public.event_assignments ea
    join public.profiles p on p.id = ea.user_id and p.status = 'active'
    where ea.event_id = p_event_id;

    insert into public.event_songs (event_id, song_id, position, key_for_event, notes)
    select v_id, es.song_id, es.position, es.key_for_event, es.notes
    from public.event_songs es
    where es.event_id = p_event_id;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.create_event_with_team(text, text, timestamptz, timestamptz, text, text, jsonb, integer)
  from public, anon;
revoke execute on function public.duplicate_event(uuid, timestamptz) from public, anon;
grant execute on function public.create_event_with_team(text, text, timestamptz, timestamptz, text, text, jsonb, integer)
  to authenticated;
grant execute on function public.duplicate_event(uuid, timestamptz) to authenticated;
