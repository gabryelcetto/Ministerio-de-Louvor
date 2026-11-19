-- =============================================================================
-- 1/4 ACESSO: perfis, permissões, funções do ministério, auditoria e helpers.
-- Regra de ouro: segurança no banco. Toda tabela tem RLS + políticas.
-- =============================================================================

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Tipos -----------------------------------------------------------------------
create type public.access_role as enum ('admin', 'leader', 'member');

-- Função genérica para manter updated_at ---------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Perfis ----------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  display_name text,
  phone text,
  access_role public.access_role not null default 'member',
  is_owner boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Um perfil por usuário do Auth. Criado por trigger.';

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Cria o perfil automaticamente quando um usuário nasce no Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'display_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Catálogo de permissões --------------------------------------------------------
create table public.permissions (
  key text primary key,
  description text not null
);

create table public.role_permissions (
  role public.access_role not null,
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (role, permission_key)
);

create table public.user_permissions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  effect text not null check (effect in ('grant', 'deny')),
  primary key (user_id, permission_key)
);

-- Helpers de autorização -------------------------------------------------------
-- is_active_member(): o usuário logado tem perfil ativo?
create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and status = 'active'
  );
$$;

-- has_permission(p): inativo → false; dono → true; exceção individual decide;
-- senão, o padrão do perfil (role_permissions).
create or replace function public.has_permission(p text)
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
  select * into v_profile from public.profiles where id = (select auth.uid());
  if not found or v_profile.status <> 'active' then
    return false;
  end if;
  if v_profile.is_owner then
    return true;
  end if;
  select up.effect into v_effect
  from public.user_permissions up
  where up.user_id = v_profile.id and up.permission_key = p;
  if found then
    return v_effect = 'grant';
  end if;
  return exists (
    select 1 from public.role_permissions rp
    where rp.role = v_profile.access_role and rp.permission_key = p
  );
end;
$$;

-- Lista as permissões efetivas do usuário logado (a UI usa para mostrar/esconder botões).
create or replace function public.my_permissions()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select p.key from public.permissions p where public.has_permission(p.key);
$$;

-- Funções do ministério --------------------------------------------------------
create table public.ministry_functions (
  id smallint generated always as identity primary key,
  name text not null unique,
  sort_order smallint not null default 0
);

create table public.member_functions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  function_id smallint not null references public.ministry_functions (id) on delete cascade,
  primary key (user_id, function_id)
);

-- Auditoria (só inserção) -------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null default auth.uid(),
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Proteção de colunas sensíveis do perfil ---------------------------------------
-- Ninguém muda o próprio access_role/status/is_owner sem members.manage.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new; -- contexto administrativo (SQL Editor, seed, migrations)
  end if;
  if new.is_owner is distinct from old.is_owner then
    raise exception 'Não é permitido alterar o dono do ministério.'
      using errcode = '42501';
  end if;
  if (new.access_role is distinct from old.access_role or new.status is distinct from old.status)
     and not public.has_permission('members.manage') then
    raise exception 'Sem permissão para alterar perfil de acesso ou status.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_update
before update on public.profiles
for each row execute function public.guard_profile_update();

-- Telefone só para quem tem members.view_contacts (ou o próprio usuário).
-- A coluna phone NÃO é legível diretamente (ver grants abaixo).
create or replace function public.get_member_contacts()
returns table (id uuid, phone text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.phone
  from public.profiles p
  where public.is_active_member()
    and (p.id = (select auth.uid()) or public.has_permission('members.view_contacts'));
$$;

-- RLS ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permissions enable row level security;
alter table public.ministry_functions enable row level security;
alter table public.member_functions enable row level security;
alter table public.audit_logs enable row level security;

-- profiles: colunas legíveis/editáveis controladas por GRANT de coluna.
revoke all on public.profiles from anon, authenticated;
grant select (id, full_name, display_name, access_role, is_owner, status, created_at, updated_at)
  on public.profiles to authenticated;
grant update (full_name, display_name, phone, access_role, status)
  on public.profiles to authenticated;

create policy "profiles: integrantes ativos leem"
  on public.profiles for select to authenticated
  using (public.is_active_member() or id = (select auth.uid()));

create policy "profiles: o próprio ou members.manage atualiza"
  on public.profiles for update to authenticated
  using (
    public.is_active_member()
    and (id = (select auth.uid()) or public.has_permission('members.manage'))
  )
  with check (
    public.is_active_member()
    and (id = (select auth.uid()) or public.has_permission('members.manage'))
  );

-- permissions / role_permissions
create policy "permissions: integrantes ativos leem"
  on public.permissions for select to authenticated
  using (public.is_active_member());

create policy "role_permissions: integrantes ativos leem"
  on public.role_permissions for select to authenticated
  using (public.is_active_member());

create policy "role_permissions: permissions.manage insere"
  on public.role_permissions for insert to authenticated
  with check (public.has_permission('permissions.manage'));

create policy "role_permissions: permissions.manage remove"
  on public.role_permissions for delete to authenticated
  using (public.has_permission('permissions.manage'));

-- user_permissions
create policy "user_permissions: o próprio ou permissions.manage lê"
  on public.user_permissions for select to authenticated
  using (
    public.is_active_member()
    and (user_id = (select auth.uid()) or public.has_permission('permissions.manage'))
  );

create policy "user_permissions: permissions.manage insere"
  on public.user_permissions for insert to authenticated
  with check (public.has_permission('permissions.manage'));

create policy "user_permissions: permissions.manage atualiza"
  on public.user_permissions for update to authenticated
  using (public.has_permission('permissions.manage'))
  with check (public.has_permission('permissions.manage'));

create policy "user_permissions: permissions.manage remove"
  on public.user_permissions for delete to authenticated
  using (public.has_permission('permissions.manage'));

-- ministry_functions / member_functions
create policy "ministry_functions: integrantes ativos leem"
  on public.ministry_functions for select to authenticated
  using (public.is_active_member());

create policy "ministry_functions: members.manage gerencia"
  on public.ministry_functions for all to authenticated
  using (public.has_permission('members.manage'))
  with check (public.has_permission('members.manage'));

create policy "member_functions: integrantes ativos leem"
  on public.member_functions for select to authenticated
  using (public.is_active_member());

create policy "member_functions: members.manage gerencia"
  on public.member_functions for all to authenticated
  using (public.has_permission('members.manage'))
  with check (public.has_permission('members.manage'));

-- audit_logs: só inserção (sem update/delete) e leitura por members.manage
create policy "audit_logs: integrante ativo registra a própria ação"
  on public.audit_logs for insert to authenticated
  with check (public.is_active_member() and actor_id = (select auth.uid()));

create policy "audit_logs: members.manage lê"
  on public.audit_logs for select to authenticated
  using (public.has_permission('members.manage'));

-- Funções expostas por RPC: só para usuários autenticados
revoke execute on function public.has_permission(text) from anon, public;
revoke execute on function public.is_active_member() from anon, public;
revoke execute on function public.my_permissions() from anon, public;
revoke execute on function public.get_member_contacts() from anon, public;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.is_active_member() to authenticated;
grant execute on function public.my_permissions() to authenticated;
grant execute on function public.get_member_contacts() to authenticated;
