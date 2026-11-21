-- =============================================================================
-- FUNÇÕES DO MINISTÉRIO: RENOMEAR, REORDENAR, DESATIVAR E EXCLUIR (Fase G, item 12).
--
-- - active: função desativada some de "Montar escala" e do cadastro (o app filtra), mas
--   continua no histórico (escalas antigas e funções de quem já tinha).
-- - move_ministry_function: sobe/desce trocando o sort_order com a vizinha (uma transação).
-- - delete_ministry_function: só exclui função que NUNCA foi usada (nem em escala nem em
--   integrante); se estiver em uso, explica e sugere desativar.
-- Renomear e ativar/desativar: UPDATE direto (members.manage pela policy já existente).
-- =============================================================================

alter table public.ministry_functions
  add column if not exists active boolean not null default true;

comment on column public.ministry_functions.active is
  'false = desativada: some de Montar escala e do cadastro, mas continua no histórico.';
-- (GRANT: a tabela já tem select/insert/update/delete para authenticated; vale para a coluna nova.)

create or replace function public.move_ministry_function(p_id smallint, p_delta integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids smallint[];
  v_index integer;
  v_target integer;
  i integer;
begin
  if not public.has_permission('members.manage') then
    raise exception 'Você não tem permissão para mudar a ordem das funções.' using errcode = '42501';
  end if;
  if p_delta not in (-1, 1) then
    raise exception 'Movimento inválido.' using errcode = '22023';
  end if;
  -- Ordem atual (empates pelo nome), renumerada 1..N e com a troca pedida.
  select array_agg(id order by sort_order, name) into v_ids from public.ministry_functions;
  v_index := array_position(v_ids, p_id);
  if v_index is null then
    raise exception 'Função não encontrada.' using errcode = 'P0002';
  end if;
  v_target := v_index + p_delta;
  if v_target < 1 or v_target > cardinality(v_ids) then
    return; -- já está na ponta
  end if;
  v_ids[v_index] := v_ids[v_target];
  v_ids[v_target] := p_id;
  for i in 1 .. cardinality(v_ids) loop
    update public.ministry_functions set sort_order = i where id = v_ids[i] and sort_order <> i;
  end loop;
end;
$$;

create or replace function public.delete_ministry_function(p_id smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('members.manage') then
    raise exception 'Você não tem permissão para excluir funções.' using errcode = '42501';
  end if;
  if exists (select 1 from public.event_assignments where function_id = p_id)
     or exists (select 1 from public.member_functions where function_id = p_id) then
    raise exception 'Esta função já foi usada em escalas ou por integrantes. Desative em vez de excluir.'
      using errcode = 'P0001';
  end if;
  delete from public.ministry_functions where id = p_id;
  if not found then
    raise exception 'Função não encontrada.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.move_ministry_function(smallint, integer) from public, anon;
revoke execute on function public.delete_ministry_function(smallint) from public, anon;
grant execute on function public.move_ministry_function(smallint, integer) to authenticated;
grant execute on function public.delete_ministry_function(smallint) to authenticated;
