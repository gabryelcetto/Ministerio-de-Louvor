-- =============================================================================
-- Presença, indisponibilidade e substituto (Fase H, item 16).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(25);

select set_config('request.jwt.claims', '', true);
insert into public.permissions (key, description) values ('schedules.manage', 't')
on conflict (key) do nothing;
insert into public.role_permissions (role, permission_key)
select 'admin', key from public.permissions on conflict do nothing;
insert into public.ministry_functions (name, section) values ('P violão', 'instrumental')
on conflict (name) do nothing;
create temp table fn as select id from public.ministry_functions where name = 'P violão';
grant select on fn to authenticated;

-- 1 admin, 2 escalada, 3 substituto livre, 4 substituto indisponível, 5 outra função, 6 outro membro
insert into auth.users (id, email, instance_id, aud, role) values
  ('c1000000-0000-4000-8000-000000000001', 'adm@p.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('c1000000-0000-4000-8000-000000000002', 'ana@p.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('c1000000-0000-4000-8000-000000000003', 'bia@p.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('c1000000-0000-4000-8000-000000000004', 'caio@p.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('c1000000-0000-4000-8000-000000000005', 'davi@p.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('c1000000-0000-4000-8000-000000000006', 'eva@p.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
update public.profiles set access_role = 'admin' where id = 'c1000000-0000-4000-8000-000000000001';
update public.profiles set display_name = 'Bia' where id = 'c1000000-0000-4000-8000-000000000003';
insert into public.member_functions (user_id, function_id) values
  ('c1000000-0000-4000-8000-000000000002', (select id from fn)),
  ('c1000000-0000-4000-8000-000000000003', (select id from fn)),
  ('c1000000-0000-4000-8000-000000000004', (select id from fn)),
  ('c1000000-0000-4000-8000-000000000006', (select id from fn));
insert into public.events (id, type, title, starts_at) values
  ('c2000000-0000-4000-8000-000000000001', 'culto', 'Culto P', date_trunc('day', now()) + interval '10 days 22 hours'),
  ('c2000000-0000-4000-8000-000000000002', 'culto', 'Culto passado', now() - interval '2 days');
insert into public.event_assignments (id, event_id, user_id, function_id) values
  ('c3000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', (select id from fn)),
  ('c3000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000006', (select id from fn)),
  ('c3000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', (select id from fn));
delete from public.notifications;

set local role authenticated;

-- Indisponibilidade: a pessoa cadastra a própria -------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select lives_ok($$
  insert into public.member_unavailability (starts_on, ends_on, note)
  values ((now() at time zone 'America/Sao_Paulo')::date + 9, (now() at time zone 'America/Sao_Paulo')::date + 11, 'Viagem')
$$, 'a pessoa cadastra a própria indisponibilidade');
select throws_ok($$
  insert into public.member_unavailability (user_id, starts_on, ends_on)
  values ('c1000000-0000-4000-8000-000000000003', current_date, current_date)
$$, '42501', null, 'mas não a de outra pessoa');
select throws_ok($$
  insert into public.member_unavailability (starts_on, ends_on) values (current_date, current_date - 1)
$$, '23514', null, 'fim antes do início é recusado');

select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is_empty($$select 1 from public.member_unavailability$$, 'outro integrante não vê a indisponibilidade alheia');
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::int from public.member_unavailability), 1, 'quem monta escala vê');

-- Substitutos --------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select results_eq(
  $$select user_id from public.assignment_substitutes('c3000000-0000-4000-8000-000000000001')$$,
  $$values ('c1000000-0000-4000-8000-000000000003'::uuid)$$,
  'substitutos: mesma função, fora da escala e disponíveis');
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok($$select * from public.assignment_substitutes('c3000000-0000-4000-8000-000000000001')$$,
  'P0002', null, 'quem não está na escala nem monta não consulta');

-- Resposta: só a própria linha e só os campos de resposta ------------------------------------------
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select lives_ok($$select public.respond_assignment('c3000000-0000-4000-8000-000000000002', 'confirmed')$$,
  'Confirmo');
select is((select row(response, responded_at is not null)::text from public.event_assignments
           where id = 'c3000000-0000-4000-8000-000000000002'), '(confirmed,t)', 'confirmado com data');
select throws_ok($$update public.event_assignments set notes = 'x' where id = 'c3000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'integrante não muda a observação');
select throws_ok($$update public.event_assignments set user_id = 'c1000000-0000-4000-8000-000000000003'
  where id = 'c3000000-0000-4000-8000-000000000002'$$, '42501', null, 'nem troca a pessoa');
update public.event_assignments set response = 'declined' where id = 'c3000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '', true);
reset role;
select is((select response from public.event_assignments where id = 'c3000000-0000-4000-8000-000000000001'),
  'pending', 'nem responde pela outra pessoa (RLS: 0 linhas)');
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$select public.respond_assignment('c3000000-0000-4000-8000-000000000001', 'declined', null,
  'c1000000-0000-4000-8000-000000000004')$$, 'P0001', null, 'sugestão indisponível é recusada');
select throws_ok($$select public.respond_assignment('c3000000-0000-4000-8000-000000000003', 'confirmed')$$,
  'P0001', null, 'evento que já passou não aceita resposta');
select throws_ok($$select public.respond_assignment('c3000000-0000-4000-8000-000000000001', 'talvez')$$,
  '23514', null, 'resposta fora da lista');
select lives_ok($$select public.respond_assignment('c3000000-0000-4000-8000-000000000001', 'declined', '  Plantão  ',
  'c1000000-0000-4000-8000-000000000003')$$, 'Não posso, com motivo e sugestão');

reset role;
select is((select row(response, response_note, suggested_user_id)::text from public.event_assignments
           where id = 'c3000000-0000-4000-8000-000000000001'),
  row('declined', 'Plantão', 'c1000000-0000-4000-8000-000000000003'::uuid)::text, 'recusa gravada');
select is((select count(*)::int from public.notifications where type = 'assignment_declined'), 1,
  'avisa só quem monta a escala');
select ok((select body like '%Motivo: Plantão. Sugestão: Bia' from public.notifications
           where type = 'assignment_declined'), 'aviso traz motivo e sugestão');

-- "Trocar por Fulano" ------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$select public.swap_assignment('c3000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000003')$$,
  '42501', null, 'integrante não troca');
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$select public.swap_assignment('c3000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000005')$$,
  'P0001', null, 'admin não troca por quem não tem a função');
select lives_ok($$select public.swap_assignment('c3000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000003')$$,
  'admin troca por Bia');
reset role;
select is((select response from public.event_assignments
           where event_id = 'c2000000-0000-4000-8000-000000000001' and user_id = 'c1000000-0000-4000-8000-000000000003'),
  'pending', 'a substituta entra como pendente');
select is((select count(*)::int from public.notifications
           where (user_id, type) in (('c1000000-0000-4000-8000-000000000002'::uuid, 'assignment_removed'),
                                     ('c1000000-0000-4000-8000-000000000003'::uuid, 'assignment_added'))), 2,
  'avisos de saída e de entrada');

-- Admin muda a pessoa direto: a resposta volta para pendente
update public.event_assignments set response = 'confirmed' where id = 'c3000000-0000-4000-8000-000000000002';
update public.event_assignments set user_id = 'c1000000-0000-4000-8000-000000000002'
where id = 'c3000000-0000-4000-8000-000000000002';
select is((select response from public.event_assignments where id = 'c3000000-0000-4000-8000-000000000002'),
  'pending', 'trocar a pessoa zera a resposta');

select * from finish();
rollback;
