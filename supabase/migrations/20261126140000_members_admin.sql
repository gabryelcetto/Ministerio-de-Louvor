-- =============================================================================
-- INTEGRANTES: EDITAR, PERFIL, DESATIVAR E PROTEÇÕES (Fase G, itens 10 e 11).
--
-- Proteções no trigger BEFORE UPDATE de profiles (valem para a tela E para a API direta):
--   - ninguém altera o perfil de acesso nem a situação do DONO (is_owner);
--   - is_owner não muda pela API;
--   - perfil de acesso (admin/integrante) só com permissions.manage; situação (ativo/inativo)
--     só com members.manage;
--   - ninguém desativa a si mesmo nem tira o próprio admin;
--   - o último administrador ativo não pode ser rebaixado nem desativado.
-- Dados de outra pessoa (nome, apelido, telefone) só com members.manage (policy de update já
-- existente); a própria pessoa edita os seus em Configurações → Minha conta.
-- update_member(): edição do admin numa transação (dados + funções), como o próprio usuário
-- (security invoker): RLS, GRANT e o trigger continuam decidindo.
-- =============================================================================

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    return new; -- contexto administrativo (SQL Editor, seed, migrations, service role)
  end if;

  if new.is_owner is distinct from old.is_owner then
    raise exception 'Não é permitido alterar o dono do ministério.' using errcode = '42501';
  end if;

  if new.access_role is distinct from old.access_role or new.status is distinct from old.status then
    if old.is_owner then
      raise exception 'O perfil e a situação do dono do ministério não podem ser alterados.'
        using errcode = '42501';
    end if;
    if new.id = v_me and new.status is distinct from old.status then
      raise exception 'Você não pode desativar a si mesmo.' using errcode = '42501';
    end if;
    if new.id = v_me and new.access_role is distinct from old.access_role then
      raise exception 'Você não pode mudar o seu próprio perfil de acesso.' using errcode = '42501';
    end if;
    if new.access_role is distinct from old.access_role
       and not public.has_permission('permissions.manage') then
      raise exception 'Só quem gerencia permissões pode mudar o perfil de acesso.'
        using errcode = '42501';
    end if;
    if new.status is distinct from old.status and not public.has_permission('members.manage') then
      raise exception 'Sem permissão para ativar ou desativar integrantes.' using errcode = '42501';
    end if;
    -- O último administrador ativo continua administrador e ativo.
    if old.access_role = 'admin' and old.status = 'active'
       and (new.access_role <> 'admin' or new.status <> 'active')
       and not exists (
         select 1 from public.profiles p
         where p.id <> old.id and p.access_role = 'admin' and p.status = 'active'
       ) then
      raise exception 'É preciso ter pelo menos um administrador ativo.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Edição do admin numa transação: dados e funções (as proteções acima continuam valendo).
create or replace function public.update_member(
  p_user_id uuid,
  p_full_name text,
  p_display_name text,
  p_phone text,
  p_function_ids smallint[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_full_name, ''));
  v_rows integer;
begin
  if not public.has_permission('members.manage') then
    raise exception 'Você não tem permissão para editar integrantes.' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Informe o nome completo (de 2 a 120 caracteres).' using errcode = '22023';
  end if;
  if char_length(coalesce(p_phone, '')) > 30 or char_length(coalesce(p_display_name, '')) > 60 then
    raise exception 'Apelido ou telefone grande demais.' using errcode = '22023';
  end if;

  -- Telefone nulo = não mexer (quem não vê telefones não apaga o que está lá). Sem ler a
  -- coluna phone, que não é legível pela API.
  if p_phone is null then
    update public.profiles set
      full_name = v_name,
      display_name = nullif(btrim(coalesce(p_display_name, '')), '')
    where id = p_user_id;
  else
    update public.profiles set
      full_name = v_name,
      display_name = nullif(btrim(coalesce(p_display_name, '')), ''),
      phone = nullif(btrim(p_phone), '')
    where id = p_user_id;
  end if;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Integrante não encontrado.' using errcode = 'P0002';
  end if;

  delete from public.member_functions
  where user_id = p_user_id and not (function_id = any (coalesce(p_function_ids, '{}')));
  insert into public.member_functions (user_id, function_id)
  select p_user_id, f from unnest(coalesce(p_function_ids, '{}')) f
  on conflict do nothing;
end;
$$;

revoke execute on function public.update_member(uuid, text, text, text, smallint[]) from public, anon;
grant execute on function public.update_member(uuid, text, text, text, smallint[]) to authenticated;
