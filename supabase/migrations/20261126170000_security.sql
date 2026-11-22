-- =============================================================================
-- SEGURANÇA DAS SENHAS E DO HISTÓRICO (Fase G, item 14).
--
-- Pendência 30 — troca de senha numa operação só: a Edge Function change-password troca a
--   senha (Auth admin) e chama finish_password_change(), que só a service role executa. A RPC
--   complete_password_change() deixa de ser executável pelo usuário (ele não libera a própria
--   conta sem trocar a senha de verdade).
-- Pendência 41 — redefinir a senha encerra as sessões abertas da pessoa:
--   revoke_user_sessions() (só service role), chamada pela Edge Function de redefinição.
-- Pendência 31 — senha provisória vale 7 dias (temp_password_expires_at, definida no cadastro e
--   na redefinição). Vencida, a conta continua sem acesso (must_change_password) e a troca é
--   recusada: só um administrador gera outra.
-- Pendência 27 — song_versions e audit_logs só por trigger/RPC: authenticated perde
--   update/delete (e insert em song_versions).
-- =============================================================================

-- 1. Prazo da senha provisória --------------------------------------------------------------
alter table public.profiles
  add column if not exists temp_password_expires_at timestamptz;
comment on column public.profiles.temp_password_expires_at is
  'Fim da validade da senha provisória (cadastro e redefinição: 7 dias). Nulo depois da troca.';
-- A tela de primeiro acesso precisa ler (avisar que venceu); ninguém altera pela API.
grant select (temp_password_expires_at) on public.profiles to authenticated;

update public.profiles
set temp_password_expires_at = now() + interval '7 days'
where must_change_password and temp_password_expires_at is null;

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
  if p_access_role = 'leader' then
    raise exception 'Perfil inválido: use integrante ou administrador.' using errcode = '22023';
  end if;
  if coalesce(p_access_role, 'member') <> 'member' and not public.has_permission('permissions.manage') then
    raise exception 'Só quem gerencia permissões pode cadastrar administradores.'
      using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Informe o nome completo (de 2 a 120 caracteres).' using errcode = '22023';
  end if;

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
    must_change_password = true,
    -- Pendência 31: a senha provisória vale 7 dias.
    temp_password_expires_at = now() + interval '7 days'
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

create or replace function public.mark_password_reset(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_can_reset_password(p_user_id);
  update public.profiles
  set must_change_password = true,
      temp_password_expires_at = now() + interval '7 days'
  where id = p_user_id;
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values ((select auth.uid()), 'reset_password', 'profile', p_user_id::text, '{}'::jsonb);
end;
$$;

-- 2. Fim da troca de senha: só a service role (Edge Function change-password) ----------------
create or replace function public.finish_password_change(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set must_change_password = false, temp_password_expires_at = null
  where id = p_user_id;
end;
$$;

revoke execute on function public.finish_password_change(uuid) from public, anon, authenticated;
grant execute on function public.finish_password_change(uuid) to service_role;

-- O usuário não libera mais a própria conta sozinho.
revoke execute on function public.complete_password_change() from public, anon, authenticated;

-- 3. Encerrar as sessões de alguém (redefinição de senha) -----------------------------------------
create or replace function public.revoke_user_sessions(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Os refresh tokens das sessões saem junto (FK com cascade); os avulsos, aqui.
  delete from auth.refresh_tokens where user_id = p_user_id::text;
  delete from auth.sessions where user_id = p_user_id;
end;
$$;

revoke execute on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;

-- 4. Pendência 27: histórico e auditoria só por trigger/RPC ---------------------------------------
revoke insert, update, delete on public.song_versions from authenticated;
revoke update, delete on public.audit_logs from authenticated;
