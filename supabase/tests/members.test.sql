-- =============================================================================
-- Cadastro de integrantes (setup_new_member) e troca de senha no primeiro acesso
-- (must_change_password + complete_password_change).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(25);

-- ---------------------------------------------------------------------------
-- Preparação (como postgres, sem usuário logado)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '', true);

insert into public.permissions (key, description) values
  ('members.manage', 't'), ('permissions.manage', 't'), ('members.view_contacts', 't')
on conflict (key) do nothing;
insert into public.role_permissions (role, permission_key)
select 'admin', key from public.permissions on conflict do nothing;
insert into public.ministry_functions (name, section) values ('Teste violão', 'instrumental'), ('Teste baixo', 'instrumental')
on conflict (name) do nothing;

insert into auth.users (id, email, instance_id, aud, role, created_at, last_sign_in_at) values
  -- quem cadastra
  ('dddddddd-0000-4000-8000-000000000001', 'admin@t.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now(), now()),
  ('dddddddd-0000-4000-8000-000000000002', 'membro@t.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now(), now()),
  ('dddddddd-0000-4000-8000-000000000003', 'gestor@t.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now(), now()),
  -- contas novas (nunca entraram)
  ('eeeeeeee-0000-4000-8000-000000000001', 'novo1@t.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now(), null),
  ('eeeeeeee-0000-4000-8000-000000000002', 'novo2@t.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now(), null),
  -- contas que NÃO podem ser "configuradas" de novo
  ('eeeeeeee-0000-4000-8000-000000000003', 'antigo@t.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now() - interval '1 day', null),
  ('eeeeeeee-0000-4000-8000-000000000004', 'jaentrou@t.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now(), now());

update public.profiles set access_role = 'admin' where id = 'dddddddd-0000-4000-8000-000000000001';
-- gestor: integrante comum com exceção individual members.manage (sem permissions.manage)
insert into public.user_permissions (user_id, permission_key, effect)
values ('dddddddd-0000-4000-8000-000000000003', 'members.manage', 'grant');

insert into public.songs (id, title) values ('ffffffff-0000-4000-8000-000000000001', 'Música de teste');

select is(
  (select must_change_password from public.profiles where id = 'eeeeeeee-0000-4000-8000-000000000001'),
  false,
  'must_change_password nasce false (default)'
);

-- ---------------------------------------------------------------------------
-- Quem pode cadastrar
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"dddddddd-0000-4000-8000-000000000002","role":"authenticated"}', true);

select throws_ok(
  $$select public.setup_new_member('eeeeeeee-0000-4000-8000-000000000001', 'Fulano', null, 'member', '{}')$$,
  '42501', null,
  'integrante sem members.manage não cadastra'
);

select set_config('request.jwt.claims',
  '{"sub":"dddddddd-0000-4000-8000-000000000003","role":"authenticated"}', true);

select throws_ok(
  $$select public.setup_new_member('eeeeeeee-0000-4000-8000-000000000001', 'Fulano', null, 'admin', '{}')$$,
  '42501', 'Só quem gerencia permissões pode cadastrar administradores.',
  'members.manage sem permissions.manage não cria admin'
);
select throws_ok(
  $$select public.setup_new_member('eeeeeeee-0000-4000-8000-000000000001', 'F', null, 'member', '{}')$$,
  '22023', null,
  'nome curto demais é recusado'
);
select lives_ok(
  $$select public.setup_new_member(
      'eeeeeeee-0000-4000-8000-000000000001', '  Fulano de Tal  ', 'Fulano', 'member',
      (select array_agg(id) from public.ministry_functions where name like 'Teste %'))$$,
  'members.manage cadastra integrante (perfil member)'
);
select throws_ok(
  $$select public.setup_new_member('eeeeeeee-0000-4000-8000-000000000003', 'Antigo', null, 'member', '{}')$$,
  '42501', 'Só é possível configurar contas recém-criadas.',
  'não reconfigura conta antiga'
);
select throws_ok(
  $$select public.setup_new_member('eeeeeeee-0000-4000-8000-000000000004', 'Já entrou', null, 'member', '{}')$$,
  '42501', 'Só é possível configurar contas recém-criadas.',
  'não reconfigura conta que já fez login'
);

select set_config('request.jwt.claims',
  '{"sub":"dddddddd-0000-4000-8000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$select public.setup_new_member('eeeeeeee-0000-4000-8000-000000000002', 'Beltrana', null, 'leader', '{}')$$,
  '22023', 'Perfil inválido: use integrante ou administrador.',
  'perfil "leader" não é mais aceito (nem pelo admin)'
);
select lives_ok(
  $$select public.setup_new_member('eeeeeeee-0000-4000-8000-000000000002', 'Beltrana', null, 'admin', '{}')$$,
  'admin (permissions.manage) cadastra administrador'
);

-- Conferência do que foi gravado (como postgres)
reset role;
select set_config('request.jwt.claims', '', true);

select is(
  (select row(full_name, display_name, access_role::text, status, must_change_password)::text
   from public.profiles where id = 'eeeeeeee-0000-4000-8000-000000000001'),
  row('Fulano de Tal', 'Fulano', 'member', 'active', true)::text,
  'perfil gravado: nome sem espaços, apelido, member, ativo, senha provisória'
);
select is(
  (select count(*)::int from public.member_functions where user_id = 'eeeeeeee-0000-4000-8000-000000000001'),
  2,
  'funções gravadas'
);
select is(
  (select access_role::text from public.profiles where id = 'eeeeeeee-0000-4000-8000-000000000002'),
  'admin',
  'administrador gravado com o perfil pedido'
);
select is(
  (select actor_id from public.audit_logs
   where action = 'invite_member' and entity_id = 'eeeeeeee-0000-4000-8000-000000000001'),
  'dddddddd-0000-4000-8000-000000000003'::uuid,
  'cadastro registrado na auditoria com quem cadastrou'
);

-- ---------------------------------------------------------------------------
-- Primeiro acesso: conta com senha provisória não acessa nada até trocar
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}', true);

select is(
  (select must_change_password from public.profiles where id = 'eeeeeeee-0000-4000-8000-000000000001'),
  true,
  'o próprio usuário lê a flag'
);
select ok(not public.is_active_member(), 'com senha provisória: não conta como integrante ativo');
select ok(not public.has_permission('members.view_contacts'), 'com senha provisória: nenhuma permissão');
select is_empty('select id from public.songs', 'com senha provisória: não lê músicas');
select throws_ok(
  $$update public.profiles set must_change_password = false where id = 'eeeeeeee-0000-4000-8000-000000000001'$$,
  '42501', null,
  'não limpa a flag por UPDATE direto (sem GRANT na coluna)'
);
select throws_ok(
  $$select public.setup_new_member('eeeeeeee-0000-4000-8000-000000000001', 'Eu mesmo', null, 'admin', '{}')$$,
  '42501', null,
  'conta bloqueada não se reconfigura'
);

-- Pendência 30: o usuário não libera a própria conta; só a Edge Function change-password
-- (service role), depois de trocar a senha de verdade.
select throws_ok($$select public.complete_password_change()$$, '42501', null,
  'complete_password_change() não é mais executável pelo usuário');
set local role service_role;
select public.finish_password_change('eeeeeeee-0000-4000-8000-000000000001');
set local role authenticated;
select is(
  (select must_change_password from public.profiles where id = 'eeeeeeee-0000-4000-8000-000000000001'),
  false,
  'flag vira false depois da troca (finish_password_change pela service role)'
);
select ok(public.is_active_member(), 'depois da troca: integrante ativo');
select isnt_empty('select id from public.songs', 'depois da troca: lê músicas');

reset role;
select is(
  (select must_change_password from public.profiles where id = 'eeeeeeee-0000-4000-8000-000000000002'),
  true,
  'a troca de uma pessoa não mexe na conta de outra'
);

-- ---------------------------------------------------------------------------
-- Anônimo
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$select public.complete_password_change()$$, '42501', null,
  'anônimo não executa complete_password_change()'
);

select * from finish();
rollback;
