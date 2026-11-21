-- =============================================================================
-- Integrantes: editar, perfil, desativar e proteções contra autopromoção (Fase G, 10 e 11).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(23);

select set_config('request.jwt.claims', '', true);
insert into public.permissions (key, description) values
  ('members.manage', 't'), ('permissions.manage', 't'), ('members.view_contacts', 't')
on conflict (key) do nothing;
insert into public.role_permissions (role, permission_key)
select 'admin', key from public.permissions on conflict do nothing;
insert into public.ministry_functions (name, section) values ('M violão', 'instrumental'), ('M voz', 'vocal')
on conflict (name) do nothing;

-- Só os perfis deste teste contam como administradores ativos.
update public.profiles set access_role = 'member';

insert into auth.users (id, email, instance_id, aud, role) values
  ('a2000000-0000-4000-8000-000000000001', 'dono@m.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('a2000000-0000-4000-8000-000000000002', 'admin@m.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('a2000000-0000-4000-8000-000000000003', 'membro@m.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('a2000000-0000-4000-8000-000000000004', 'gestor@m.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
update public.profiles set is_owner = true, access_role = 'admin', status = 'inactive'
where id = 'a2000000-0000-4000-8000-000000000001';
update public.profiles set access_role = 'admin', phone = '(11) 90000-0002'
where id = 'a2000000-0000-4000-8000-000000000002';
update public.profiles set phone = '(11) 90000-0003' where id = 'a2000000-0000-4000-8000-000000000003';
-- gestor: integrante com members.manage (sem permissions.manage)
insert into public.user_permissions (user_id, permission_key, effect)
values ('a2000000-0000-4000-8000-000000000004', 'members.manage', 'grant');

set local role authenticated;

-- ---------------------------------------------------------------------------
-- A própria pessoa (Minha conta)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select lives_ok(
  $$update public.profiles set full_name = 'Membro Novo', display_name = 'Mem', phone = '11 99999-0000'
    where id = 'a2000000-0000-4000-8000-000000000003'$$,
  'integrante edita o próprio nome, apelido e telefone');
select throws_ok(
  $$update public.profiles set access_role = 'admin' where id = 'a2000000-0000-4000-8000-000000000003'$$,
  '42501', null, 'integrante não vira admin pela API');
select throws_ok(
  $$update public.profiles set status = 'inactive' where id = 'a2000000-0000-4000-8000-000000000003'$$,
  '42501', null, 'integrante não muda a própria situação');
select throws_ok(
  $$update public.profiles set is_owner = true where id = 'a2000000-0000-4000-8000-000000000003'$$,
  '42501', null, 'integrante não vira dono');
select is(
  (select count(*)::int from public.get_member_contacts()), 1,
  'sem members.view_contacts: só o próprio telefone chega ao app');
select throws_ok(
  $$select phone from public.profiles$$, '42501', null,
  'a coluna phone não é legível pela API');
update public.profiles set full_name = 'Hackeado' where id = 'a2000000-0000-4000-8000-000000000002';
reset role;
select isnt((select full_name from public.profiles where id = 'a2000000-0000-4000-8000-000000000002'),
  'Hackeado', 'integrante não edita o perfil de outra pessoa (RLS)');

-- ---------------------------------------------------------------------------
-- Gestor (members.manage, sem permissions.manage)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select lives_ok(
  $$select public.update_member('a2000000-0000-4000-8000-000000000003', 'Membro Editado', '', '(11) 3333-4444',
     (select array_agg(id) from public.ministry_functions where name like 'M %'))$$,
  'gestor edita dados e funções de um integrante');
select throws_ok(
  $$update public.profiles set access_role = 'admin' where id = 'a2000000-0000-4000-8000-000000000003'$$,
  '42501', 'Só quem gerencia permissões pode mudar o perfil de acesso.',
  'members.manage sem permissions.manage não muda o perfil de acesso');
select lives_ok(
  $$update public.profiles set status = 'inactive' where id = 'a2000000-0000-4000-8000-000000000003'$$,
  'gestor desativa um integrante');
select throws_ok(
  $$update public.profiles set status = 'inactive' where id = 'a2000000-0000-4000-8000-000000000004'$$,
  '42501', 'Você não pode desativar a si mesmo.', 'ninguém desativa a si mesmo');
select throws_ok(
  $$select public.update_member('a2000000-0000-4000-8000-000000000003', 'X', '', '', '{}')$$,
  '22023', null, 'nome curto é recusado');

reset role;
select is(
  (select row(full_name, display_name, phone, status)::text from public.profiles where id = 'a2000000-0000-4000-8000-000000000003'),
  row('Membro Editado', null::text, '(11) 3333-4444', 'inactive')::text,
  'dados gravados (apelido vazio vira nulo)');
select is(
  (select count(*)::int from public.member_functions where user_id = 'a2000000-0000-4000-8000-000000000003'),
  2, 'funções trocadas');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select public.update_member('a2000000-0000-4000-8000-000000000003', 'Membro Editado', '', null,
  (select array_agg(id) from public.ministry_functions where name like 'M %'));
reset role;
select is((select phone from public.profiles where id = 'a2000000-0000-4000-8000-000000000003'),
  '(11) 3333-4444', 'telefone nulo = não mexe no telefone');

-- ---------------------------------------------------------------------------
-- Admin (permissions.manage): perfil, dono e último admin
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.get_member_contacts()) >= 2, true,
  'com members.view_contacts: vê os telefones');
select throws_ok(
  $$update public.profiles set status = 'active' where id = 'a2000000-0000-4000-8000-000000000001'$$,
  '42501', 'O perfil e a situação do dono do ministério não podem ser alterados.',
  'ninguém altera o dono');
select throws_ok(
  $$update public.profiles set access_role = 'member' where id = 'a2000000-0000-4000-8000-000000000002'$$,
  '42501', 'Você não pode mudar o seu próprio perfil de acesso.', 'ninguém tira o próprio admin');
select lives_ok(
  $$update public.profiles set access_role = 'admin' where id = 'a2000000-0000-4000-8000-000000000004'$$,
  'admin promove o gestor');
select lives_ok(
  $$update public.profiles set status = 'active' where id = 'a2000000-0000-4000-8000-000000000003'$$,
  'admin reativa o integrante');

-- O gestor (agora admin) tenta rebaixar o último outro admin ativo
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select lives_ok(
  $$update public.profiles set access_role = 'member' where id = 'a2000000-0000-4000-8000-000000000002'$$,
  'havendo outro admin ativo, dá para rebaixar');
reset role;
-- Agora só o gestor é admin ativo; simula outra pessoa com permissions.manage tentando rebaixá-lo.
insert into public.user_permissions (user_id, permission_key, effect)
values ('a2000000-0000-4000-8000-000000000003', 'permissions.manage', 'grant'),
       ('a2000000-0000-4000-8000-000000000003', 'members.manage', 'grant');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok(
  $$update public.profiles set access_role = 'member' where id = 'a2000000-0000-4000-8000-000000000004'$$,
  '42501', 'É preciso ter pelo menos um administrador ativo.', 'o último admin ativo não é rebaixado');
select throws_ok(
  $$update public.profiles set status = 'inactive' where id = 'a2000000-0000-4000-8000-000000000004'$$,
  '42501', 'É preciso ter pelo menos um administrador ativo.', 'nem desativado');

select * from finish();
rollback;
