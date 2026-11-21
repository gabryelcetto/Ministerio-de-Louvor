-- =============================================================================
-- Eventos: criar com equipe numa transação, repetir toda semana e duplicar (Fase G, item 3).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(18);

select set_config('request.jwt.claims', '', true);
insert into public.permissions (key, description) values
  ('events.manage', 't'), ('schedules.manage', 't')
on conflict (key) do nothing;
insert into public.role_permissions (role, permission_key)
select 'admin', key from public.permissions on conflict do nothing;
insert into public.ministry_functions (name, section) values ('E vocal', 'vocal')
on conflict (name) do nothing;

insert into auth.users (id, email, instance_id, aud, role) values
  ('b1000000-0000-4000-8000-000000000001', 'adm@e.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('b1000000-0000-4000-8000-000000000002', 'membro@e.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('b1000000-0000-4000-8000-000000000003', 'inativo@e.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('b1000000-0000-4000-8000-000000000004', 'eventos@e.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
update public.profiles set access_role = 'admin' where id = 'b1000000-0000-4000-8000-000000000001';
update public.profiles set status = 'inactive' where id = 'b1000000-0000-4000-8000-000000000003';
-- Só events.manage (sem schedules.manage)
insert into public.user_permissions (user_id, permission_key, effect)
values ('b1000000-0000-4000-8000-000000000004', 'events.manage', 'grant');

set local role authenticated;

-- Sem permissão
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok(
  $$select public.create_event_with_team('culto', 'X', now() + interval '1 day', null, null, null)$$,
  '42501', null, 'integrante não cria evento');

-- events.manage sem schedules.manage: cria sem equipe, mas não escala
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select lives_ok(
  $$select public.create_event_with_team('evento', 'Só evento', now() + interval '2 days', null, 'Praça', null)$$,
  'events.manage cria evento sem equipe');
select throws_ok(
  format($$select public.create_event_with_team('culto', 'Com equipe', now() + interval '2 days', null, null, null, %L)$$,
    jsonb_build_array(jsonb_build_object('user_id', 'b1000000-0000-4000-8000-000000000002',
      'function_id', (select id from public.ministry_functions where name = 'E vocal')))),
  '42501', 'Você não tem permissão para montar escalas.', 'sem schedules.manage não escala');

-- Admin: validações
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok(
  $$select public.create_event_with_team('culto', '  ', now(), null, null, null)$$,
  '22023', null, 'título em branco é recusado');
select throws_ok(
  $$select public.create_event_with_team('culto', 'X', now(), now() - interval '1 hour', null, null)$$,
  '22023', 'O término precisa ser depois do início.', 'término antes do início é recusado');
select throws_ok(
  $$select public.create_event_with_team('culto', 'X', now(), null, null, null, '[]', 13)$$,
  '22023', 'Repita de 1 a 12 semanas.', 'mais de 12 semanas é recusado');
select throws_ok(
  format($$select public.create_event_with_team('culto', 'X', now(), null, null, null, %L)$$,
    jsonb_build_array(jsonb_build_object('user_id', 'b1000000-0000-4000-8000-000000000003',
      'function_id', (select id from public.ministry_functions where name = 'E vocal')))),
  '22023', 'Só integrantes ativos podem ser escalados.', 'inativo não é escalado');

-- Transação: um erro na equipe não deixa evento órfão
reset role;
select is((select count(*)::int from public.events where title = 'X'), 0,
  'nada ficou gravado pelas tentativas recusadas');

-- Repetição semanal com equipe (virada do mês e mesmo horário de Brasília)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok(
  format($$select set_config('t.ids', public.create_event_with_team('ensaio', 'Ensaio semanal',
      '2030-01-22 22:30:00+00', '2030-01-23 00:30:00+00', 'Sala 2', null, %L, 3)::text, true)$$,
    jsonb_build_array(jsonb_build_object('user_id', 'b1000000-0000-4000-8000-000000000002',
      'function_id', (select id from public.ministry_functions where name = 'E vocal'), 'notes', ' Abre '))),
  'admin cria 3 ensaios semanais com equipe');

reset role;
select is(
  (select array_agg(to_char(starts_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') order by starts_at)
   from public.events where title = 'Ensaio semanal'),
  array['22/01 19:30', '29/01 19:30', '05/02 19:30'],
  '3 eventos, toda semana no mesmo horário (virando o mês)');
select is(
  (select array_agg(ends_at - starts_at) from public.events where title = 'Ensaio semanal'),
  array[interval '2 hours', interval '2 hours', interval '2 hours'],
  'mesma duração em todos');
select is(
  (select count(*)::int from public.event_assignments ea join public.events e on e.id = ea.event_id
   where e.title = 'Ensaio semanal' and ea.notes = 'Abre'),
  3, 'mesma equipe em todos (observação sem espaços)');
select is(
  (select count(*)::int from public.event_songs es join public.events e on e.id = es.event_id
   where e.title = 'Ensaio semanal'),
  0, 'repetição sem repertório');
select is(
  (select count(*)::int from public.notifications
   where user_id = 'b1000000-0000-4000-8000-000000000002' and title like 'Você foi escalado(a)%'),
  1, 'a pessoa recebe UM aviso para os 3 eventos');

-- Um evento só: aviso normal (pelo trigger)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok(
  format($$select set_config('t.one', (public.create_event_with_team('culto', 'Culto único',
      now() + interval '3 days', null, null, null, %L))[1]::text, true)$$,
    jsonb_build_array(jsonb_build_object('user_id', 'b1000000-0000-4000-8000-000000000002',
      'function_id', (select id from public.ministry_functions where name = 'E vocal')))),
  'admin cria um culto com equipe');

-- Duplicar
select lives_ok(
  format($$select set_config('t.dup', public.duplicate_event(%L, now() + interval '10 days')::text, true)$$,
    current_setting('t.one')),
  'admin duplica o evento com nova data');
reset role;
select is(
  (select count(*)::int from public.event_assignments where event_id = current_setting('t.dup')::uuid),
  1, 'a cópia leva a equipe');
select is(
  (select count(*)::int from public.notifications
   where user_id = 'b1000000-0000-4000-8000-000000000002' and link = '/escalas/' || current_setting('t.dup')),
  1, 'quem entrou na cópia é avisado');

select * from finish();
rollback;
