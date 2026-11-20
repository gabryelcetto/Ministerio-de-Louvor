-- =============================================================================
-- CADASTRO DE INTEGRANTES (sem cadastro público) e TROCA DE SENHA NO PRIMEIRO ACESSO.
--
-- Fluxo: a Edge Function `invite-member` confere a permissão do usuário logado, cria a conta no
-- Auth com uma senha provisória (service role, só no servidor) e chama `setup_new_member()`
-- COMO O PRÓPRIO USUÁRIO LOGADO. Quem decide se pode cadastrar, e com qual perfil, é o banco.
-- A conta nasce com `must_change_password = true`: até trocar a senha, ela não lê nem altera
-- nada (is_active_member/has_permission tratam como inativa) — não é só a tela que bloqueia.
-- =============================================================================

-- Coluna --------------------------------------------------------------------------------------
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  'true para contas criadas com senha provisória (invite-member); vira false em complete_password_change().';

-- GRANT: o próprio usuário precisa LER a flag (a tela de "Defina sua senha" depende dela), mas
-- ninguém altera pela API: só a função security definer abaixo (sem GRANT de update na coluna).
grant select (must_change_password) on public.profiles to authenticated;
-- (RLS: a policy de select de profiles já deixa cada um ler o próprio perfil mesmo bloqueado.)

-- Helpers de autorização: conta com senha provisória = sem acesso até trocar ---------------------
create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and status = 'active'
      and not must_change_password
  );
$$;

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
  if not found or v_profile.status <> 'active' or v_profile.must_change_password then
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

-- Configurar a conta recém-criada ---------------------------------------------------------------
-- Chamada pela Edge Function com o JWT de quem está cadastrando (não com a service role).
create or replace function public.setup_new_member(
  p_user_id uuid,
  p_full_name text,
  p_display_name text,
  p_access_role public.access_role,
  p_function_ids smallint[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created_at timestamptz;
  v_last_sign_in timestamptz;
  v_name text := btrim(coalesce(p_full_name, ''));
begin
  if not public.has_permission('members.manage') then
    raise exception 'Você não tem permissão para cadastrar integrantes.' using errcode = '42501';
  end if;
  if coalesce(p_access_role, 'member') <> 'member' and not public.has_permission('permissions.manage') then
    raise exception 'Só quem gerencia permissões pode cadastrar líderes ou administradores.'
      using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Informe o nome completo (de 2 a 120 caracteres).' using errcode = '22023';
  end if;

  -- Só contas recém-criadas e que nunca entraram: impede usar esta função para mudar o perfil
  -- de alguém que já existe (isso é trabalho de members.manage por outro caminho).
  select created_at, last_sign_in_at into v_created_at, v_last_sign_in
  from auth.users where id = p_user_id;
  if not found then
    raise exception 'Conta não encontrada.' using errcode = 'P0002';
  end if;
  if v_last_sign_in is not null or v_created_at < now() - interval '10 minutes' then
    raise exception 'Só é possível configurar contas recém-criadas.' using errcode = '42501';
  end if;

  insert into public.profiles (id, full_name) values (p_user_id, v_name)
  on conflict (id) do nothing;

  update public.profiles set
    full_name = v_name,
    display_name = nullif(btrim(coalesce(p_display_name, '')), ''),
    access_role = coalesce(p_access_role, 'member'),
    status = 'active',
    must_change_password = true
  where id = p_user_id;

  insert into public.member_functions (user_id, function_id)
  select p_user_id, f from unnest(coalesce(p_function_ids, '{}')) as f
  on conflict do nothing;

  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (
    (select auth.uid()), 'invite_member', 'profile', p_user_id::text,
    jsonb_build_object('access_role', coalesce(p_access_role, 'member'), 'function_ids', p_function_ids)
  );
end;
$$;

-- Fim do primeiro acesso: só para o próprio usuário, depois de trocar a senha no Auth.
create or replace function public.complete_password_change()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Faça login para continuar.' using errcode = '42501';
  end if;
  update public.profiles set must_change_password = false where id = (select auth.uid());
end;
$$;

revoke execute on function public.setup_new_member(uuid, text, text, public.access_role, smallint[])
  from anon, public;
revoke execute on function public.complete_password_change() from anon, public;
grant execute on function public.setup_new_member(uuid, text, text, public.access_role, smallint[])
  to authenticated;
grant execute on function public.complete_password_change() to authenticated;
