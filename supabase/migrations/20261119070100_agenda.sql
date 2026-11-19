-- =============================================================================
-- 2/4 AGENDA: eventos (cultos, ensaios, eventos) e escalas (atribuições).
-- =============================================================================

create table public.events (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('culto', 'ensaio', 'evento')),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  notes text,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_ends_after_starts check (ends_at is null or ends_at >= starts_at)
);
create index events_starts_at_idx on public.events (starts_at);

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

-- A "escala" de um evento = conjunto de atribuições (quem toca/canta o quê).
create table public.event_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  function_id smallint not null references public.ministry_functions (id),
  notes text,
  created_at timestamptz not null default now(),
  unique (event_id, user_id, function_id)
);
create index event_assignments_user_idx on public.event_assignments (user_id);

alter table public.events enable row level security;
alter table public.event_assignments enable row level security;

create policy "events: integrantes ativos leem"
  on public.events for select to authenticated
  using (public.is_active_member());

create policy "events: events.manage insere"
  on public.events for insert to authenticated
  with check (public.has_permission('events.manage'));

create policy "events: events.manage atualiza"
  on public.events for update to authenticated
  using (public.has_permission('events.manage'))
  with check (public.has_permission('events.manage'));

create policy "events: events.manage remove"
  on public.events for delete to authenticated
  using (public.has_permission('events.manage'));

create policy "event_assignments: integrantes ativos leem"
  on public.event_assignments for select to authenticated
  using (public.is_active_member());

create policy "event_assignments: schedules.manage insere"
  on public.event_assignments for insert to authenticated
  with check (public.has_permission('schedules.manage'));

create policy "event_assignments: schedules.manage atualiza"
  on public.event_assignments for update to authenticated
  using (public.has_permission('schedules.manage'))
  with check (public.has_permission('schedules.manage'));

create policy "event_assignments: schedules.manage remove"
  on public.event_assignments for delete to authenticated
  using (public.has_permission('schedules.manage'));
