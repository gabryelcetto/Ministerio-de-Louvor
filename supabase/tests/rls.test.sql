-- =============================================================================
-- Testes pgTAP de RLS e triggers. Rode com: supabase test db
-- Tudo acontece dentro de uma transação desfeita no final (rollback).
-- Perfis testados: admin, líder, integrante, integrante inativo e anônimo.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(31);

-- ---------------------------------------------------------------------------
-- Preparação (como postgres, sem usuário logado → auth.uid() nulo)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '', true);

insert into public.permissions (key, description) values
  ('schedules.manage', 't'), ('events.manage', 't'), ('announcements.manage', 't'),
  ('songs.delete', 't'), ('chords.edit_official', 't'), ('songs.set_official_key', 't'),
  ('members.view_contacts', 't'), ('members.manage', 't'), ('permissions.manage', 't'),
  ('history.restore', 't')
on conflict (key) do nothing;
insert into public.role_permissions (role, permission_key)
select 'admin', key from public.permissions on conflict do nothing;
insert into public.role_permissions (role, permission_key) values
  ('leader', 'chords.edit_official'), ('leader', 'songs.set_official_key'),
  ('leader', 'history.restore'), ('leader', 'schedules.manage')
on conflict do nothing;
insert into public.ministry_functions (name) values ('Teste função') on conflict (name) do nothing;

insert into auth.users (id, email, instance_id, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'admin@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'lider@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'membro@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'membro2@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'inativo@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

select is(
  (select count(*)::int from public.profiles where id::text like 'aaaaaaaa-%'),
  5,
  'trigger cria um profile para cada usuário do Auth'
);

update public.profiles set access_role = 'admin' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
update public.profiles set access_role = 'leader' where id = 'aaaaaaaa-0000-4000-8000-000000000002';
update public.profiles set access_role = 'leader', status = 'inactive'
  where id = 'aaaaaaaa-0000-4000-8000-000000000005';

insert into public.songs (id, title, original_key, official_key) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Hino de teste', 'G', 'G'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Hino sem cifra', 'C', null);
insert into public.song_lyrics (song_id, content) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'letra original');
insert into public.song_chords (song_id, content) values
  ('bbbbbbbb-0000-4000-8000-000000000001', '[G]letra original');

insert into public.events (id, type, title, starts_at) values
  ('cccccccc-0000-4000-8000-000000000001', 'culto', 'Culto de teste', now() + interval '2 days');

-- ---------------------------------------------------------------------------
-- ANÔNIMO
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

-- Sem GRANT para anon (como num projeto novo da nuvem), o banco recusa antes do RLS.
select throws_ok(
  'select id from public.songs', '42501', null,
  'anônimo não lê músicas (sem privilégio de tabela)'
);
select throws_ok(
  'select song_id from public.song_lyrics', '42501', null,
  'anônimo não lê letras (sem privilégio de tabela)'
);
select throws_ok(
  'select public.get_dashboard()', '42501', null,
  'anônimo não executa get_dashboard()'
);

-- ---------------------------------------------------------------------------
-- INTEGRANTE (member)
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated"}', true);

select isnt_empty('select id from public.songs', 'integrante lê músicas');
select ok(not public.has_permission('chords.edit_official'), 'integrante não tem chords.edit_official');

update public.song_lyrics set content = 'letra editada pelo integrante'
  where song_id = 'bbbbbbbb-0000-4000-8000-000000000001';
select is(
  (select content from public.song_lyrics where song_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  'letra editada pelo integrante',
  'integrante edita a letra'
);
select is(
  (select count(*)::int from public.song_versions
    where song_id = 'bbbbbbbb-0000-4000-8000-000000000001' and field = 'lyrics'
      and change_type = 'update' and changed_by = 'aaaaaaaa-0000-4000-8000-000000000003'
      and old_value = 'letra original' and new_value = 'letra editada pelo integrante'),
  1,
  'trigger grava a versão da letra com autor, valor antigo e novo'
);

update public.song_chords set content = '[A]hackeado'
  where song_id = 'bbbbbbbb-0000-4000-8000-000000000001';
select is(
  (select content from public.song_chords where song_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  '[G]letra original',
  'integrante NÃO edita a cifra oficial (RLS ignora o UPDATE)'
);

insert into public.song_chords (song_id, content, review_status)
  values ('bbbbbbbb-0000-4000-8000-000000000002', '[C]sugestão', 'official');
select is(
  (select review_status from public.song_chords where song_id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  'pending',
  'cifra enviada por integrante nasce pending mesmo pedindo official'
);

select throws_ok(
  $$update public.songs set official_key = 'A' where id = 'bbbbbbbb-0000-4000-8000-000000000001'$$,
  '42501', null,
  'integrante NÃO altera o tom oficial'
);
select lives_ok(
  $$update public.songs set notes = 'observação' where id = 'bbbbbbbb-0000-4000-8000-000000000001'$$,
  'integrante altera outros metadados da música'
);
select throws_ok(
  $$insert into public.song_versions (song_id, field, change_type) values ('bbbbbbbb-0000-4000-8000-000000000001', 'lyrics', 'update')$$,
  null, null,
  'integrante não insere versões diretamente'
);
select throws_ok(
  $$select public.restore_song_version((select id from public.song_versions limit 1))$$,
  '42501', null,
  'integrante não restaura versões'
);
select throws_ok(
  $$update public.profiles set access_role = 'admin' where id = 'aaaaaaaa-0000-4000-8000-000000000003'$$,
  '42501', null,
  'integrante não se promove a admin'
);
select throws_ok(
  $$select phone from public.profiles$$,
  '42501', null,
  'coluna phone não é legível diretamente'
);
select throws_ok(
  $$insert into public.notifications (user_id, type, title) values ('aaaaaaaa-0000-4000-8000-000000000003', 'x', 'x')$$,
  '42501', null,
  'integrante não cria notificações'
);
select throws_ok(
  $$insert into public.events (type, title, starts_at) values ('culto', 'x', now())$$,
  '42501', null,
  'integrante não cria eventos'
);
select ok(public.get_dashboard() ? 'next_service', 'integrante executa get_dashboard()');

-- ---------------------------------------------------------------------------
-- LÍDER (leader)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}', true);

select lives_ok(
  $$update public.songs set official_key = 'A' where id = 'bbbbbbbb-0000-4000-8000-000000000001'$$,
  'líder altera o tom oficial'
);
select is(
  (select count(*)::int from public.song_versions
    where song_id = 'bbbbbbbb-0000-4000-8000-000000000001' and field = 'official_key'
      and old_value = 'G' and new_value = 'A'),
  1,
  'trigger grava a versão do tom oficial'
);

update public.song_chords set content = '[A]cifra do líder'
  where song_id = 'bbbbbbbb-0000-4000-8000-000000000001';
select is(
  (select content from public.song_chords where song_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  '[A]cifra do líder',
  'líder edita a cifra oficial'
);

-- Restaura a letra original (versão de criação) — grava como nova alteração "restore".
select lives_ok(
  $$select public.restore_song_version((
      select id from public.song_versions
      where song_id = 'bbbbbbbb-0000-4000-8000-000000000001' and field = 'lyrics' and change_type = 'create'
    ))$$,
  'líder restaura versão'
);
select is(
  (select content from public.song_lyrics where song_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  'letra original',
  'restauração devolve o conteúdo antigo'
);
select is(
  (select count(*)::int from public.song_versions
    where song_id = 'bbbbbbbb-0000-4000-8000-000000000001' and field = 'lyrics' and change_type = 'restore'),
  1,
  'restauração fica registrada como nova versão'
);

-- Escala → notificações
insert into public.event_assignments (event_id, user_id, function_id)
select 'cccccccc-0000-4000-8000-000000000001', u, (select id from public.ministry_functions where name = 'Teste função')
from unnest(array['aaaaaaaa-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000004']::uuid[]) as u;

-- ---------------------------------------------------------------------------
-- ADMIN
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);

select ok(public.has_permission('permissions.manage'), 'admin tem todas as permissões');
update public.song_chords set content = '[B]cifra do admin'
  where song_id = 'bbbbbbbb-0000-4000-8000-000000000001';
select is(
  (select content from public.song_chords where song_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  '[B]cifra do admin',
  'admin edita a cifra oficial'
);

-- ---------------------------------------------------------------------------
-- NOTIFICAÇÕES: cada um só vê as suas
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.notifications),
  1,
  'integrante vê só a própria notificação de escala'
);
select is(
  (select count(*)::int from public.notifications where user_id = 'aaaaaaaa-0000-4000-8000-000000000004'),
  0,
  'integrante não vê notificações de outro usuário'
);

-- ---------------------------------------------------------------------------
-- INATIVO (líder com status inactive)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000005","role":"authenticated"}', true);

select ok(not public.has_permission('chords.edit_official'), 'inativo perde todas as permissões');
select is_empty('select id from public.songs', 'inativo não lê músicas');

select * from finish();
rollback;
