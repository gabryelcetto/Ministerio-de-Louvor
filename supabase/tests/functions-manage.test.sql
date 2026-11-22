-- =============================================================================
-- Funções do ministério: renomear, reordenar, desativar e excluir (Fase G, item 12).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(11);

select set_config('request.jwt.claims', '', true);
insert into public.permissions (key, description) values ('members.manage', 't')
on conflict (key) do nothing;
insert into public.role_permissions (role, permission_key) values ('admin', 'members.manage')
on conflict do nothing;

-- Só as funções deste teste.
delete from public.member_functions;
delete from public.event_assignments;
delete from public.ministry_functions;
insert into public.ministry_functions (name, section, sort_order) values
  ('F um', 'vocal', 1), ('F dois', 'instrumental', 2), ('F tres', 'instrumental', 3);

insert into auth.users (id, email, instance_id, aud, role) values
  ('a3000000-0000-4000-8000-000000000001', 'adm@fn.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('a3000000-0000-4000-8000-000000000002', 'membro@fn.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
update public.profiles set access_role = 'admin' where id = 'a3000000-0000-4000-8000-000000000001';
insert into public.member_functions (user_id, function_id)
select 'a3000000-0000-4000-8000-000000000002', id from public.ministry_functions where name = 'F um';

select is(
  (select bool_and(active) from public.ministry_functions), true, 'funções nascem ativas');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a3000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok(
  $$select public.move_ministry_function((select id from public.ministry_functions where name = 'F dois'), -1)$$,
  '42501', null, 'integrante não reordena');
select throws_ok(
  $$select public.delete_ministry_function((select id from public.ministry_functions where name = 'F tres'))$$,
  '42501', null, 'integrante não exclui');
update public.ministry_functions set active = false;
reset role;
select is((select count(*)::int from public.ministry_functions where not active), 0,
  'integrante não desativa (RLS)');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a3000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok(
  $$select public.move_ministry_function((select id from public.ministry_functions where name = 'F tres'), -1)$$,
  'admin sobe uma função');
select is(
  (select array_agg(name order by sort_order) from public.ministry_functions),
  array['F um', 'F tres', 'F dois'], 'ordem trocada com a vizinha');
select lives_ok(
  $$select public.move_ministry_function((select id from public.ministry_functions where name = 'F um'), -1)$$,
  'subir a primeira não faz nada');
select lives_ok(
  $$update public.ministry_functions set name = 'F 1', active = false where name = 'F um'$$,
  'admin renomeia e desativa');
select throws_ok(
  $$select public.delete_ministry_function((select id from public.ministry_functions where name = 'F 1'))$$,
  'P0001', 'Esta função já foi usada em escalas ou por integrantes. Desative em vez de excluir.',
  'função usada não é excluída');
select lives_ok(
  $$select public.delete_ministry_function((select id from public.ministry_functions where name = 'F dois'))$$,
  'função nunca usada é excluída');
reset role;
select is(
  (select array_agg(name || ':' || active order by sort_order) from public.ministry_functions),
  array['F 1:false', 'F tres:true'], 'resultado final');

select * from finish();
rollback;
