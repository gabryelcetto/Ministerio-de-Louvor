-- =============================================================================
-- Comunicado agendado e job publicar-comunicados (Fase H, item 17).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

select set_config('request.jwt.claims', '', true);
insert into public.permissions (key, description) values ('announcements.manage', 't')
on conflict (key) do nothing;
insert into public.role_permissions (role, permission_key) values ('admin', 'announcements.manage')
on conflict do nothing;
insert into auth.users (id, email, instance_id, aud, role) values
  ('d1000000-0000-4000-8000-000000000001', 'adm@ag.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('d1000000-0000-4000-8000-000000000002', 'membro@ag.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
update public.profiles set access_role = 'admin' where id = 'd1000000-0000-4000-8000-000000000001';
delete from public.notifications;

select is((select count(*)::int from cron.job where jobname = 'publicar-comunicados'
           and schedule = '*/5 * * * *'), 1, 'job a cada 5 minutos');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;
insert into ids select 'agendado', public.save_announcement(null, 'Agendado', 'Texto', '{"type":"all"}',
  null, now() + interval '2 hours');
insert into ids select 'agora', public.save_announcement(null, 'Agora', 'Texto', '{"type":"all"}', null, null);

select ok((select published_at > now() + interval '1 hour' and notified_at is null
           from public.announcements where id = (select id from ids where name = 'agendado')),
  'agendado: data futura e sem aviso');
select ok((select notified_at is not null from public.announcements
           where id = (select id from ids where name = 'agora')), 'publicar agora: avisado na hora');
select throws_ok(
  format('select public.remind_announcement(%L)', (select id from ids where name = 'agendado')),
  'P0001', 'Este comunicado ainda não foi publicado.', 'agendado não recebe lembrete');

select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.announcements where title = 'Agendado'), 0,
  'integrante não vê o agendado');
select is((select count(*)::int from public.notifications where title = 'Novo comunicado: Agendado'), 0,
  'nem recebe aviso antes da hora');
select is((select count(*)::int from public.notifications where title = 'Novo comunicado: Agora'), 1,
  'o publicado agora avisa');
select throws_ok('select public.publish_due_announcements()', '42501', null,
  'integrante não dispara o job');

-- Editar o agendado continua agendado; "Publicar agora" na edição avisa todo mundo.
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok(format($$select public.save_announcement(%L, 'Agendado', 'Texto 2', '{"type":"all"}',
  null, now() + interval '3 hours')$$, (select id from ids where name = 'agendado')),
  'edita o agendado');
reset role;
select is(public.publish_due_announcements(), 0, 'job: nada vencido ainda');

-- Chega a hora
update public.announcements set published_at = now() - interval '1 minute'
where id = (select id from ids where name = 'agendado');
select is(public.publish_due_announcements(), 1, 'job publica o vencido');
select is((select count(*)::int from public.notifications where title = 'Novo comunicado: Agendado'
           and user_id = 'd1000000-0000-4000-8000-000000000002'), 1, 'integrante avisado');
select is((select count(*)::int from public.notifications where title = 'Novo comunicado: Agendado'
           and user_id = 'd1000000-0000-4000-8000-000000000001'), 0, 'autor não recebe');
select is(public.publish_due_announcements(), 0, 'rodar de novo não repete o aviso');

select * from finish();
rollback;
