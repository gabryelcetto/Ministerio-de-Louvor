-- =============================================================================
-- COMUNICADO AGENDADO (Fase H, item 17).
--
-- "Publicar agora" ou "Agendar": save_announcement ganha p_publish_at. Agendado, o comunicado
-- fica com published_at no futuro (o RLS já esconde dos integrantes) e notified_at nulo.
-- O job "publicar-comunicados" (pg_cron, a cada 5 minutos) chama publish_due_announcements,
-- que recalcula o público, avisa cada pessoa e marca notified_at.
-- =============================================================================

create extension if not exists pg_cron with schema pg_catalog;

alter table public.announcements add column if not exists notified_at timestamptz default now();
-- Os que já existiam foram avisados na hora da publicação.
update public.announcements set notified_at = published_at
where notified_at is null and published_at <= now();

drop function if exists public.save_announcement(uuid, text, text, jsonb, timestamptz);

create or replace function public.save_announcement(
  p_id uuid,
  p_title text,
  p_body text,
  p_filter jsonb,
  p_pinned_until timestamptz default null,
  p_publish_at timestamptz default null
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
  -- "Agendar": publica e avisa na data escolhida (job publicar-comunicados, a cada 5 minutos).
  v_publish timestamptz := greatest(coalesce(p_publish_at, now()), now());
  v_due boolean := coalesce(p_publish_at, now()) <= now();
  v_notified timestamptz;
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
    insert into public.announcements
      (title, body, audience, audience_filter, pinned_until, created_by, published_at, notified_at)
    values (v_title, v_body, v_audience, v_filter, p_pinned_until, v_me,
            case when v_due then now() else v_publish end,
            case when v_due then now() end)
    returning id into v_id;
    v_notify := case when v_due then v_new else '{}' end;
  else
    select a.audience_filter, a.notified_at into v_old_filter, v_notified
    from public.announcements a where a.id = p_id for update;
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
    if v_notified is null then
      -- Ainda agendado: a nova data vale; "Publicar agora" avisa todo o público.
      update public.announcements set
        published_at = case when v_due then now() else v_publish end,
        notified_at = case when v_due then now() end
      where id = v_id;
      v_notify := case when v_due then v_new else '{}' end;
    -- Edição: só avisa se o público mudou, e só quem entrou agora.
    elsif v_old_filter is distinct from v_filter then
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

revoke execute on function public.save_announcement(uuid, text, text, jsonb, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.save_announcement(uuid, text, text, jsonb, timestamptz, timestamptz)
  to authenticated;

-- Publica os agendados que venceram (só o job chama).
create or replace function public.publish_due_announcements()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.announcements%rowtype;
  v_count integer := 0;
begin
  for v_a in
    select * from public.announcements
    where notified_at is null and published_at <= now()
    order by published_at
    for update skip locked
  loop
    -- Público do momento da publicação (quem entrou ou saiu do ministério desde o agendamento).
    delete from public.announcement_recipients r
    where r.announcement_id = v_a.id
      and not (r.user_id in (select u from public.announcement_audience(v_a.audience_filter) u));
    insert into public.announcement_recipients (announcement_id, user_id)
    select v_a.id, u from public.announcement_audience(v_a.audience_filter) u
    on conflict do nothing;

    insert into public.notifications (user_id, type, title, body, link)
    select r.user_id, 'announcement', 'Novo comunicado: ' || v_a.title, left(v_a.body, 140),
           '/comunicados/' || v_a.id
    from public.announcement_recipients r
    where r.announcement_id = v_a.id and r.user_id is distinct from v_a.created_by;

    update public.announcements set notified_at = now() where id = v_a.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.publish_due_announcements() from public, anon, authenticated;

-- Lembrete só depois de publicado.
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
  if v_a.notified_at is null then
    raise exception 'Este comunicado ainda não foi publicado.' using errcode = 'P0001';
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

-- Job a cada 5 minutos (cron.schedule com o mesmo nome substitui o anterior).
select cron.schedule(
  'publicar-comunicados',
  '*/5 * * * *',
  'select public.publish_due_announcements()'
);
