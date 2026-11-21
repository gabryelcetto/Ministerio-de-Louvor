-- =============================================================================
-- Segurança das senhas e do histórico (Fase G, item 14; pendências 27, 30, 31 e 41).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(13);

select set_config('request.jwt.claims', '', true);
insert into public.permissions (key, description) values
  ('members.manage', 't'), ('permissions.manage', 't')
on conflict (key) do nothing;
insert into public.role_permissions (role, permission_key)
select 'admin', key from public.permissions on conflict do nothing;

insert into auth.users (id, email, instance_id, aud, role, created_at, last_sign_in_at) values
  ('a6000000-0000-4000-8000-000000000001', 'adm@s.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now(), now()),
  ('a6000000-0000-4000-8000-000000000002', 'novo@s.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now(), null),
  ('a6000000-0000-4000-8000-000000000003', 'antigo@s.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now(), now());
update public.profiles set access_role = 'admin', is_owner = true
where id = 'a6000000-0000-4000-8000-000000000001';
insert into auth.sessions (user_id) values
  ('a6000000-0000-4000-8000-000000000003'), ('a6000000-0000-4000-8000-000000000003'),
  ('a6000000-0000-4000-8000-000000000001');
insert into auth.refresh_tokens (user_id, session_id, token)
select user_id::text, id, 'tok' from auth.sessions;
insert into public.songs (id, title) values ('a7000000-0000-4000-8000-000000000001', 'Segura');

-- Cadastro e redefinição: senha provisória vale 7 dias ----------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.setup_new_member('a6000000-0000-4000-8000-000000000002', 'Pessoa Nova', null, 'member', '{}');
select public.mark_password_reset('a6000000-0000-4000-8000-000000000003');
reset role;
select ok(
  (select temp_password_expires_at between now() + interval '6 days 23 hours' and now() + interval '7 days 1 minute'
   from public.profiles where id = 'a6000000-0000-4000-8000-000000000002'),
  'cadastro: senha provisória vale 7 dias');
select ok(
  (select must_change_password and temp_password_expires_at > now() + interval '6 days'
   from public.profiles where id = 'a6000000-0000-4000-8000-000000000003'),
  'redefinição: obriga a trocar e vale 7 dias');

-- Troca de senha: só a service role libera a conta ----------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$select public.complete_password_change()$$, '42501', null,
  'o usuário não libera a própria conta pela RPC antiga');
select throws_ok($$select public.finish_password_change('a6000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'nem pela nova (só service role)');
select ok(not public.is_active_member(), 'com senha provisória: sem acesso');

set local role service_role;
select lives_ok($$select public.finish_password_change('a6000000-0000-4000-8000-000000000002')$$,
  'service role (Edge Function) libera depois de trocar a senha');
reset role;
select is(
  (select row(must_change_password, temp_password_expires_at)::text from public.profiles
   where id = 'a6000000-0000-4000-8000-000000000002'),
  row(false, null::timestamptz)::text, 'flag e prazo limpos');

-- Encerrar sessões (redefinição) -----------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$select public.revoke_user_sessions('a6000000-0000-4000-8000-000000000003')$$,
  '42501', null, 'nem o admin encerra sessões pela API (só a Edge Function)');
set local role service_role;
select lives_ok($$select public.revoke_user_sessions('a6000000-0000-4000-8000-000000000003')$$,
  'service role encerra as sessões');
reset role;
select is((select count(*)::int from auth.sessions where user_id = 'a6000000-0000-4000-8000-000000000003'),
  0, 'as sessões da pessoa acabaram');
select is((select count(*)::int from auth.sessions where user_id = 'a6000000-0000-4000-8000-000000000001'),
  1, 'as dos outros continuam');

-- Pendência 27: histórico e auditoria não são alterados pela API ----------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$update public.song_versions set new_value = 'x'$$, '42501', null,
  'nem o admin altera o histórico');
select throws_ok($$delete from public.audit_logs$$, '42501', null, 'nem apaga a auditoria');

select * from finish();
rollback;
