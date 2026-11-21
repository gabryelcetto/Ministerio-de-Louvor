-- =============================================================================
-- ADMIN REDEFINE A SENHA DE UM INTEGRANTE + GRUPO OBRIGATÓRIO NAS FUNÇÕES DO MINISTÉRIO.
-- Idempotente (create or replace / drop default / revoke+grant).
--
-- Fluxo da redefinição (Edge Function `reset-member-password`, chamando o banco COMO O ADMIN):
--   1. prepare_password_reset(alvo): confere as regras e devolve nome e e-mail do alvo;
--   2. a função troca a senha com a service role (Auth admin);
--   3. mark_password_reset(alvo): confere de novo, marca must_change_password = true e registra
--      em audit_logs. A pessoa entra com a senha provisória e é obrigada a trocar.
-- Regras (todas no banco):
--   - exige members.manage;
--   - ninguém redefine a senha do DONO por aqui;
--   - a senha de outro ADMIN só o dono redefine;
--   - a própria senha se troca em Configurações (aqui não).
-- =============================================================================

-- Regras num lugar só (uso interno das duas RPCs abaixo) ------------------------------------
create or replace function public.assert_can_reset_password(p_user_id uuid)
returns public.profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me public.profiles%rowtype;
  v_target public.profiles%rowtype;
begin
  if not public.has_permission('members.manage') then
    raise exception 'Você não tem permissão para redefinir senhas.' using errcode = '42501';
  end if;
  select * into v_me from public.profiles where id = (select auth.uid());
  select * into v_target from public.profiles where id = p_user_id;
  if not found then
    raise exception 'Integrante não encontrado.' using errcode = 'P0002';
  end if;
  if v_target.id = v_me.id then
    raise exception 'Para trocar a sua própria senha, use Configurações.' using errcode = '22023';
  end if;
  if v_target.is_owner then
    raise exception 'A senha do dono do ministério não pode ser redefinida por aqui.'
      using errcode = '42501';
  end if;
  if v_target.access_role = 'admin' and not v_me.is_owner then
    raise exception 'Só o dono do ministério pode redefinir a senha de outro administrador.'
      using errcode = '42501';
  end if;
  return v_target;
end;
$$;

revoke execute on function public.assert_can_reset_password(uuid) from public, anon, authenticated;

create or replace function public.prepare_password_reset(p_user_id uuid)
returns table (full_name text, display_name text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_target public.profiles%rowtype;
begin
  v_target := public.assert_can_reset_password(p_user_id);
  return query
  select v_target.full_name, v_target.display_name, u.email::text
  from auth.users u where u.id = p_user_id;
end;
$$;

create or replace function public.mark_password_reset(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_can_reset_password(p_user_id);
  update public.profiles set must_change_password = true where id = p_user_id;
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values ((select auth.uid()), 'reset_password', 'profile', p_user_id::text, '{}'::jsonb);
end;
$$;

revoke execute on function public.prepare_password_reset(uuid) from public, anon;
revoke execute on function public.mark_password_reset(uuid) from public, anon;
grant execute on function public.prepare_password_reset(uuid) to authenticated;
grant execute on function public.mark_password_reset(uuid) to authenticated;

-- Pendência 34: função do ministério sem grupo não entra mais (o app pergunta) ----------------
-- As existentes já têm grupo; só tira o padrão "instrumental" que escondia o esquecimento.
alter table public.ministry_functions alter column section drop default;
