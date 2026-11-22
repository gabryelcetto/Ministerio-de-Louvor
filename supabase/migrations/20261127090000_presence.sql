-- =============================================================================
-- PRESENÇA, INDISPONIBILIDADE E SUBSTITUTO (Fase H, item 16).
--
-- event_assignments ganha a resposta da pessoa ("Confirmo" / "Não posso"), com motivo e
-- sugestão de substituto. A própria pessoa só muda esses campos e só na própria linha
-- (política + trigger). Trocar a pessoa volta a resposta para "pending".
-- "Não posso" avisa quem tem schedules.manage; "Trocar por Fulano" é a RPC swap_assignment.
-- member_unavailability: períodos em que a pessoa não pode ser escalada.
-- =============================================================================

-- Resposta ---------------------------------------------------------------------------------------
alter table public.event_assignments
  add column if not exists response text not null default 'pending',
  add column if not exists response_note text,
  add column if not exists responded_at timestamptz,
  -- Sem FK de propósito: uma segunda FK para profiles deixaria ambíguos os embeds "profiles(...)"
  -- da API. A sugestão é validada no trigger (assignment_substitutes).
  add column if not exists suggested_user_id uuid;

alter table public.event_assignments drop constraint if exists event_assignments_response_check;
alter table public.event_assignments add constraint event_assignments_response_check
  check (response in ('pending', 'confirmed', 'declined'));
alter table public.event_assignments drop constraint if exists event_assignments_response_note_len;
alter table public.event_assignments add constraint event_assignments_response_note_len
  check (char_length(response_note) <= 300);

-- Indisponibilidade --------------------------------------------------------------------------------
create table if not exists public.member_unavailability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  constraint member_unavailability_period check (ends_on >= starts_on)
);
create index if not exists member_unavailability_user_idx
  on public.member_unavailability (user_id, ends_on);

alter table public.member_unavailability enable row level security;
revoke all on public.member_unavailability from anon, authenticated;
grant select, insert, update, delete on public.member_unavailability to authenticated;

-- A própria pessoa e quem monta escala leem; só a própria pessoa grava.
drop policy if exists "member_unavailability: dono ou quem monta escala lê" on public.member_unavailability;
create policy "member_unavailability: dono ou quem monta escala lê"
  on public.member_unavailability for select to authenticated
  using (
    public.is_active_member()
    and (user_id = (select auth.uid()) or public.has_permission('schedules.manage'))
  );
drop policy if exists "member_unavailability: dono insere" on public.member_unavailability;
create policy "member_unavailability: dono insere"
  on public.member_unavailability for insert to authenticated
  with check (public.is_active_member() and user_id = (select auth.uid()));
drop policy if exists "member_unavailability: dono atualiza" on public.member_unavailability;
create policy "member_unavailability: dono atualiza"
  on public.member_unavailability for update to authenticated
  using (public.is_active_member() and user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists "member_unavailability: dono remove" on public.member_unavailability;
create policy "member_unavailability: dono remove"
  on public.member_unavailability for delete to authenticated
  using (public.is_active_member() and user_id = (select auth.uid()));

-- A pessoa está indisponível no dia (São Paulo) do evento?
create or replace function public.is_unavailable(p_user_id uuid, p_day date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.member_unavailability u
    where u.user_id = p_user_id and p_day between u.starts_on and u.ends_on
  );
$$;
revoke execute on function public.is_unavailable(uuid, date) from public, anon, authenticated;

-- Substitutos possíveis: ativos, com a mesma função, fora da escala do evento e disponíveis.
-- Só a pessoa escalada ou quem monta escala consulta.
create or replace function public.assignment_substitutes(p_assignment_id uuid)
returns table (user_id uuid, name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_a public.event_assignments%rowtype;
  v_day date;
begin
  select * into v_a from public.event_assignments where id = p_assignment_id;
  if not found or not public.is_active_member()
     or (v_a.user_id <> (select auth.uid()) and not public.has_permission('schedules.manage')) then
    raise exception 'Escala não encontrada.' using errcode = 'P0002';
  end if;
  select (e.starts_at at time zone 'America/Sao_Paulo')::date into v_day
  from public.events e where e.id = v_a.event_id;

  return query
    select p.id, coalesce(p.display_name, p.full_name)
    from public.profiles p
    join public.member_functions mf on mf.user_id = p.id and mf.function_id = v_a.function_id
    where p.status = 'active'
      and not p.must_change_password
      and not exists (
        select 1 from public.event_assignments x where x.event_id = v_a.event_id and x.user_id = p.id
      )
      and not public.is_unavailable(p.id, v_day)
    order by 2;
end;
$$;
revoke execute on function public.assignment_substitutes(uuid) from public, anon;
grant execute on function public.assignment_substitutes(uuid) to authenticated;

-- Política: a pessoa atualiza a própria linha (o trigger limita aos campos de resposta).
drop policy if exists "event_assignments: a pessoa responde a própria" on public.event_assignments;
create policy "event_assignments: a pessoa responde a própria"
  on public.event_assignments for update to authenticated
  using (public.is_active_member() and user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.guard_assignment_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manager boolean := public.has_permission('schedules.manage');
  v_starts timestamptz;
begin
  -- Trocar a pessoa (ou a função) zera a resposta.
  if new.user_id is distinct from old.user_id or new.function_id is distinct from old.function_id then
    if not v_manager and (select auth.uid()) is not null then
      raise exception 'Só quem monta a escala troca a pessoa.' using errcode = '42501';
    end if;
    new.response := 'pending';
    new.response_note := null;
    new.responded_at := null;
    new.suggested_user_id := null;
    return new;
  end if;

  if not v_manager and (select auth.uid()) is not null then
    if old.user_id <> (select auth.uid()) then
      raise exception 'Você só responde à sua própria escala.' using errcode = '42501';
    end if;
    if new.event_id is distinct from old.event_id or new.notes is distinct from old.notes
       or new.created_at is distinct from old.created_at then
      raise exception 'Você só pode responder (Confirmo / Não posso).' using errcode = '42501';
    end if;
  end if;

  if new.response is distinct from old.response
     or new.response_note is distinct from old.response_note
     or new.suggested_user_id is distinct from old.suggested_user_id then
    select starts_at into v_starts from public.events where id = new.event_id;
    if v_starts < now() then
      raise exception 'Este evento já passou.' using errcode = 'P0001';
    end if;
    if new.response <> 'declined' then
      new.response_note := null;
      new.suggested_user_id := null;
    end if;
    new.response_note := nullif(btrim(new.response_note), '');
    if new.suggested_user_id is not null and not exists (
      select 1 from public.assignment_substitutes(new.id) s where s.user_id = new.suggested_user_id
    ) then
      raise exception 'Essa pessoa não pode substituir neste evento.' using errcode = 'P0001';
    end if;
    new.responded_at := case when new.response = 'pending' then null else now() end;
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_assignment_update() from public, anon, authenticated;

drop trigger if exists event_assignments_guard_update on public.event_assignments;
create trigger event_assignments_guard_update
before update on public.event_assignments
for each row execute function public.guard_assignment_update();

-- Mesma regra de has_permission, para outra pessoa (quem recebe o aviso).
create or replace function public.member_has_permission(p_user_id uuid, p text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_effect text;
begin
  select * into v_profile from public.profiles where id = p_user_id;
  if not found or v_profile.status <> 'active' or v_profile.must_change_password then
    return false;
  end if;
  if v_profile.is_owner then
    return true;
  end if;
  select up.effect into v_effect
  from public.user_permissions up
  where up.user_id = p_user_id and up.permission_key = p;
  if found then
    return v_effect = 'grant';
  end if;
  return exists (
    select 1 from public.role_permissions rp
    where rp.role = v_profile.access_role and rp.permission_key = p
  );
end;
$$;
revoke execute on function public.member_has_permission(uuid, text) from public, anon, authenticated;

-- "Não posso": avisa quem monta a escala (com a sugestão, se houver).
create or replace function public.notify_assignment_declined()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_who text;
  v_function text;
  v_suggested text;
  v_body text;
begin
  if new.response <> 'declined' or old.response = 'declined' then
    return new;
  end if;
  select * into v_event from public.events where id = new.event_id;
  select coalesce(display_name, full_name) into v_who from public.profiles where id = new.user_id;
  select name into v_function from public.ministry_functions where id = new.function_id;
  select coalesce(display_name, full_name) into v_suggested
  from public.profiles where id = new.suggested_user_id;

  v_body := coalesce(v_function, 'Função') || ' — '
    || to_char(v_event.starts_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI');
  if new.response_note is not null then
    v_body := v_body || '. Motivo: ' || new.response_note;
  end if;
  if v_suggested is not null then
    v_body := v_body || '. Sugestão: ' || v_suggested;
  end if;

  insert into public.notifications (user_id, type, title, body, link)
  select p.id, 'assignment_declined',
         coalesce(v_who, 'Alguém') || ' não pode: ' || v_event.title,
         v_body,
         '/escalas/' || v_event.id
  from public.profiles p
  where p.id <> new.user_id
    and public.member_has_permission(p.id, 'schedules.manage');
  return new;
end;
$$;
revoke execute on function public.notify_assignment_declined() from public, anon, authenticated;

drop trigger if exists event_assignments_notify_declined on public.event_assignments;
create trigger event_assignments_notify_declined
after update of response on public.event_assignments
for each row execute function public.notify_assignment_declined();

-- Responder (atalho da tela; as regras estão no trigger e no RLS) ---------------------------------
create or replace function public.respond_assignment(
  p_assignment_id uuid,
  p_response text,
  p_note text default null,
  p_suggested_user_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.event_assignments
     set response = p_response,
         response_note = p_note,
         suggested_user_id = p_suggested_user_id
   where id = p_assignment_id
     and user_id = (select auth.uid());
  if not found then
    raise exception 'Escala não encontrada.' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.respond_assignment(uuid, text, text, uuid) from public, anon;
grant execute on function public.respond_assignment(uuid, text, text, uuid) to authenticated;

-- "Trocar por Fulano": tira quem não pode e escala a outra pessoa (avisos pelos triggers).
create or replace function public.swap_assignment(p_assignment_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_a public.event_assignments%rowtype;
  v_new uuid;
begin
  if not public.has_permission('schedules.manage') then
    raise exception 'Sem permissão para montar a escala.' using errcode = '42501';
  end if;
  select * into v_a from public.event_assignments where id = p_assignment_id;
  if not found then
    raise exception 'Escala não encontrada.' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.assignment_substitutes(p_assignment_id) s where s.user_id = p_user_id
  ) then
    raise exception 'Essa pessoa não pode substituir neste evento.' using errcode = 'P0001';
  end if;
  delete from public.event_assignments where id = p_assignment_id;
  insert into public.event_assignments (event_id, user_id, function_id, notes)
  values (v_a.event_id, p_user_id, v_a.function_id, v_a.notes)
  returning id into v_new;
  return v_new;
end;
$$;
revoke execute on function public.swap_assignment(uuid, uuid) from public, anon;
grant execute on function public.swap_assignment(uuid, uuid) to authenticated;

-- Início: resposta nas minhas escalas e recusas no "Precisa de atenção" --------------------------
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
  -- Mesmas regras de src/features/escalas/pending.ts: sem equipe; culto sem repertório; recusas.
  pending_events as (
    select e.id, e.title, e.type, e.starts_at,
           not exists (select 1 from public.event_assignments ea where ea.event_id = e.id) as no_team,
           (e.type = 'culto'
             and not exists (select 1 from public.event_songs es where es.event_id = e.id)) as no_songs,
           (select count(*)::int from public.event_assignments ea
             where ea.event_id = e.id and ea.response = 'declined') as declined
    from public.events e
    where e.status = 'scheduled'
      and e.starts_at >= now()
      and e.starts_at < now() + interval '14 days'
      and (
        not exists (select 1 from public.event_assignments ea where ea.event_id = e.id)
        or (e.type = 'culto'
            and not exists (select 1 from public.event_songs es where es.event_id = e.id))
        or exists (select 1 from public.event_assignments ea
                   where ea.event_id = e.id and ea.response = 'declined')
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
               'function', mf.name,
               'response', ea.response
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
