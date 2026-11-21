-- =============================================================================
-- Redefinição de senha por admin (migration 20261124090000_member_password_reset.sql) e grupo
-- obrigatório nas funções do ministério (pendência 34).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(17);

select set_config('request.jwt.claims', '', true);

insert into auth.users (id, email, instance_id, aud, role) values
  ('c5000000-0000-4000-8000-000000000001', 'dono@reset.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('c5000000-0000-4000-8000-000000000002', 'admin2@reset.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('c5000000-0000-4000-8000-000000000003', 'gestor@reset.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('c5000000-0000-4000-8000-000000000004', 'membro@reset.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('c5000000-0000-4000-8000-000000000005', 'alvo@reset.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

update public.profiles set access_role = 'admin', is_owner = true, full_name = 'Dono'
  where id = 'c5000000-0000-4000-8000-000000000001';
update public.profiles set access_role = 'admin', full_name = 'Admin Dois'
  where id = 'c5000000-0000-4000-8000-000000000002';
update public.profiles set full_name = 'Alvo Teste'
  where id = 'c5000000-0000-4000-8000-000000000005';
-- gestor: integrante com exceção members.manage (não é dono nem admin)
insert into public.user_permissions (user_id, permission_key, effect)
values ('c5000000-0000-4000-8000-000000000003', 'members.manage', 'grant');

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Integrante comum: sem members.manage
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"c5000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select throws_ok(
  $$select * from public.prepare_password_reset('c5000000-0000-4000-8000-000000000005')$$,
  '42501', 'Você não tem permissão para redefinir senhas.',
  'integrante não redefine senha'
);
select throws_ok(
  $$select public.mark_password_reset('c5000000-0000-4000-8000-000000000005')$$,
  '42501', null,
  'integrante não marca a troca obrigatória'
);
select throws_ok(
  $$select public.assert_can_reset_password('c5000000-0000-4000-8000-000000000005')$$,
  '42501', null,
  'a função interna de regras não é exposta'
);

-- ---------------------------------------------------------------------------
-- Gestor (members.manage, não é dono)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"c5000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is(
  (select email from public.prepare_password_reset('c5000000-0000-4000-8000-000000000005')),
  'alvo@reset.local',
  'members.manage prepara a redefinição de um integrante (nome e e-mail)'
);
select throws_ok(
  $$select * from public.prepare_password_reset('c5000000-0000-4000-8000-000000000002')$$,
  '42501', 'Só o dono do ministério pode redefinir a senha de outro administrador.',
  'gestor não redefine a senha de um admin'
);
select throws_ok(
  $$select * from public.prepare_password_reset('c5000000-0000-4000-8000-000000000001')$$,
  '42501', 'A senha do dono do ministério não pode ser redefinida por aqui.',
  'ninguém redefine a senha do dono'
);
select throws_ok(
  $$select * from public.prepare_password_reset('c5000000-0000-4000-8000-000000000003')$$,
  '22023', null,
  'a própria senha não (é em Configurações)'
);
select throws_ok(
  $$select * from public.prepare_password_reset('c5000000-0000-4000-8000-0000000000ff')$$,
  'P0002', null,
  'integrante inexistente'
);
select lives_ok(
  $$select public.mark_password_reset('c5000000-0000-4000-8000-000000000005')$$,
  'gestor marca a troca obrigatória'
);

-- ---------------------------------------------------------------------------
-- Dono: pode redefinir a senha de outro admin; não a própria
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"c5000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok(
  $$select public.mark_password_reset('c5000000-0000-4000-8000-000000000002')$$,
  'dono redefine a senha de outro admin'
);
select throws_ok(
  $$select public.mark_password_reset('c5000000-0000-4000-8000-000000000001')$$,
  '22023', 'Para trocar a sua própria senha, use Configurações.',
  'nem o dono redefine a própria senha por aqui (é em Configurações)'
);

-- Conferência como postgres
reset role;
select set_config('request.jwt.claims', '', true);
select is(
  (select must_change_password from public.profiles where id = 'c5000000-0000-4000-8000-000000000005'),
  true,
  'alvo fica com troca obrigatória de senha no próximo acesso'
);
select is(
  (select count(*)::int from public.audit_logs
   where action = 'reset_password' and entity_id = 'c5000000-0000-4000-8000-000000000005'
     and actor_id = 'c5000000-0000-4000-8000-000000000003'),
  1,
  'redefinição registrada na auditoria com quem fez'
);

-- ---------------------------------------------------------------------------
-- Pendência 34: grupo obrigatório ao cadastrar função
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.ministry_functions (name) values ('Sem grupo')$$,
  '23502', null,
  'função sem grupo é recusada (o app pergunta cantores/instrumentistas)'
);
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c5000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.ministry_functions (name, section) values ('Ministro(a) teste', 'vocal')$$,
  'members.manage cadastra função vocal'
);
select set_config('request.jwt.claims',
  '{"sub":"c5000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.ministry_functions (name, section) values ('Outra', 'vocal')$$,
  '42501', null,
  'integrante não cadastra função'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$select * from public.prepare_password_reset('c5000000-0000-4000-8000-000000000005')$$,
  '42501', null,
  'anônimo não executa prepare_password_reset'
);

select * from finish();
rollback;
