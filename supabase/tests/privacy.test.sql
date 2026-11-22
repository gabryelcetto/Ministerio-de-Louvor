-- Aceite da política de privacidade (Fase G, item 15).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(5);

insert into auth.users (id, email, instance_id, aud, role) values
  ('a8000000-0000-4000-8000-000000000001', 'p1@p.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('a8000000-0000-4000-8000-000000000002', 'p2@p.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a8000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$update public.profiles set privacy_version = 'x' where id = 'a8000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'aceite não é editável pela API');
select throws_ok($$select public.accept_privacy('')$$, '22023', null, 'versão vazia é recusada');
select lives_ok($$select public.accept_privacy('2026-11')$$, 'a pessoa registra o próprio aceite');
reset role;
select is((select privacy_version from public.profiles where id = 'a8000000-0000-4000-8000-000000000001'),
  '2026-11', 'versão gravada');
select is((select privacy_accepted_at from public.profiles where id = 'a8000000-0000-4000-8000-000000000002'),
  null, 'não mexe no perfil de outra pessoa');
select * from finish();
rollback;
