-- =============================================================================
-- Repertório do evento: set_event_songs (Fase G, item 4) e políticas de event_songs.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

select set_config('request.jwt.claims', '', true);
insert into public.permissions (key, description) values ('schedules.manage', 't')
on conflict (key) do nothing;
insert into public.role_permissions (role, permission_key) values ('admin', 'schedules.manage')
on conflict do nothing;
insert into public.ministry_functions (name, section) values ('S teclado', 'instrumental')
on conflict (name) do nothing;

insert into auth.users (id, email, instance_id, aud, role) values
  ('c1000000-0000-4000-8000-000000000001', 'adm@s.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('c1000000-0000-4000-8000-000000000002', 'membro@s.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
update public.profiles set access_role = 'admin' where id = 'c1000000-0000-4000-8000-000000000001';

insert into public.events (id, type, title, starts_at) values
  ('c2000000-0000-4000-8000-000000000001', 'culto', 'Culto teste', now() + interval '3 days');
insert into public.event_assignments (event_id, user_id, function_id)
select 'c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', id
from public.ministry_functions where name = 'S teclado';
insert into public.songs (id, title, official_key) values
  ('c3000000-0000-4000-8000-000000000001', 'Primeira', 'G'),
  ('c3000000-0000-4000-8000-000000000002', 'Segunda', 'D'),
  ('c3000000-0000-4000-8000-000000000003', 'Terceira', 'A');
insert into public.songs (id, title, archived_at) values
  ('c3000000-0000-4000-8000-000000000004', 'Arquivada', now());
insert into public.event_songs (event_id, song_id, position) values
  ('c2000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001', 1),
  ('c2000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000002', 2);
delete from public.notifications;

set local role authenticated;

-- Integrante: lê, mas não monta
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.event_songs where event_id = 'c2000000-0000-4000-8000-000000000001'), 2,
  'integrante lê o repertório');
select throws_ok(
  $$select public.set_event_songs('c2000000-0000-4000-8000-000000000001', '[]')$$,
  '42501', null, 'integrante não troca o repertório pela RPC');
update public.event_songs set notes = 'x';
select is(
  (select count(*)::int from public.event_songs where notes = 'x'),
  0, 'integrante não altera event_songs direto (RLS: nenhuma linha muda)');
select throws_ok(
  $$insert into public.event_songs (event_id, song_id, position) values ('c2000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000003', 9)$$,
  '42501', null, 'integrante não insere em event_songs');

-- Admin: reordena, troca e põe tom do dia
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(
  public.set_event_songs('c2000000-0000-4000-8000-000000000001', jsonb_build_array(
    jsonb_build_object('song_id', 'c3000000-0000-4000-8000-000000000003', 'key_for_event', 'B', 'notes', ' Abertura '),
    jsonb_build_object('song_id', 'c3000000-0000-4000-8000-000000000001', 'key_for_event', ''),
    jsonb_build_object('song_id', 'c3000000-0000-4000-8000-000000000002'))),
  3, 'admin salva 3 músicas');
select results_eq(
  $$select song_id::text, position::int, coalesce(key_for_event, '-'), coalesce(notes, '-')
    from public.event_songs where event_id = 'c2000000-0000-4000-8000-000000000001' order by position$$,
  $$values ('c3000000-0000-4000-8000-000000000003', 1, 'B', 'Abertura'),
           ('c3000000-0000-4000-8000-000000000001', 2, '-', '-'),
           ('c3000000-0000-4000-8000-000000000002', 3, '-', '-')$$,
  'nova ordem com posições 1..3, tom do dia e observação');
select throws_ok(
  $$select public.set_event_songs('c2000000-0000-4000-8000-000000000001',
    '[{"song_id":"c3000000-0000-4000-8000-000000000004"}]')$$,
  '22023', null, 'música arquivada não entra');
select throws_ok(
  $$select public.set_event_songs('c2000000-0000-4000-8000-000000000099', '[]')$$,
  'P0002', null, 'evento inexistente');
select throws_ok(
  $$select public.set_event_songs('c2000000-0000-4000-8000-000000000001',
    '[{"song_id":"c3000000-0000-4000-8000-000000000001","key_for_event":"Muito longo"}]')$$,
  '22023', null, 'tom grande demais é recusado');

reset role;
select is(
  (select count(*)::int from public.notifications
   where user_id = 'c1000000-0000-4000-8000-000000000002' and type = 'event_songs_updated'),
  1, 'quem está escalado recebe UM aviso por salvamento');
select is(
  (select link from public.notifications where type = 'event_songs_updated' limit 1),
  '/escalas/c2000000-0000-4000-8000-000000000001#repertorio', 'o aviso leva ao repertório do evento');
select is(
  (select count(*)::int from public.notifications where user_id = 'c1000000-0000-4000-8000-000000000001'),
  0, 'quem salvou não recebe aviso');

select * from finish();
rollback;
