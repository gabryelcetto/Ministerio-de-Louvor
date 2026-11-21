-- =============================================================================
-- "Tocada em", contagens do repertório e favoritos (Fase G, item 8).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

select set_config('request.jwt.claims', '', true);
insert into auth.users (id, email, instance_id, aud, role) values
  ('f1000000-0000-4000-8000-000000000001', 'um@f.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('f1000000-0000-4000-8000-000000000002', 'dois@f.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

insert into public.songs (id, title, official_key) values
  ('f2000000-0000-4000-8000-000000000001', 'Tocada duas vezes', 'G'),
  ('f2000000-0000-4000-8000-000000000002', 'Nunca tocada', 'D');
insert into public.events (id, type, title, starts_at, status) values
  ('f3000000-0000-4000-8000-000000000001', 'culto', 'Culto antigo', now() - interval '30 days', 'scheduled'),
  ('f3000000-0000-4000-8000-000000000002', 'culto', 'Culto recente', now() - interval '7 days', 'scheduled'),
  ('f3000000-0000-4000-8000-000000000003', 'culto', 'Culto cancelado', now() - interval '3 days', 'cancelled'),
  ('f3000000-0000-4000-8000-000000000004', 'culto', 'Culto futuro', now() + interval '3 days', 'scheduled');
insert into public.event_songs (event_id, song_id, position, key_for_event) values
  ('f3000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 1, null),
  ('f3000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001', 1, 'A'),
  ('f3000000-0000-4000-8000-000000000003', 'f2000000-0000-4000-8000-000000000001', 1, null),
  ('f3000000-0000-4000-8000-000000000004', 'f2000000-0000-4000-8000-000000000001', 1, null);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select is(
  (select play_count from public.get_song_stats() where song_id = 'f2000000-0000-4000-8000-000000000001'),
  2, 'conta só eventos que já aconteceram e não foram cancelados');
select ok(
  (select last_played_at > now() - interval '8 days' from public.get_song_stats()
   where song_id = 'f2000000-0000-4000-8000-000000000001'),
  'última vez = o culto recente');
select is_empty(
  $$select 1 from public.get_song_stats() where song_id = 'f2000000-0000-4000-8000-000000000002'$$,
  'música nunca tocada não aparece (a tela trata como 0)');
select is(
  (public.get_song_plays('f2000000-0000-4000-8000-000000000001') ->> 'total')::int, 2,
  '"Tocada em": total');
select is(
  (select array_agg(x ->> 'title') from jsonb_array_elements(
     public.get_song_plays('f2000000-0000-4000-8000-000000000001') -> 'recent') x),
  array['Culto recente', 'Culto antigo'], '"Tocada em": do mais recente ao mais antigo');
select is(
  (select array_agg(x ->> 'key') from jsonb_array_elements(
     public.get_song_plays('f2000000-0000-4000-8000-000000000001') -> 'recent') x),
  array['A', 'G'], 'com o tom do dia (ou o oficial)');
select is(
  jsonb_array_length(public.get_song_plays('f2000000-0000-4000-8000-000000000001', 1) -> 'recent'),
  1, 'limite de itens');

-- Favoritos: cada um só vê e altera os seus
insert into public.song_favorites (user_id, song_id)
values ('f1000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001');
select throws_ok(
  $$insert into public.song_favorites (user_id, song_id)
    values ('f1000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'não favorita em nome de outra pessoa');

select set_config('request.jwt.claims', '{"sub":"f1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is_empty('select song_id from public.song_favorites', 'não vê os favoritos dos outros');
delete from public.song_favorites;
reset role;
select is((select count(*)::int from public.song_favorites), 1, 'não apaga os favoritos dos outros');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select isnt_empty('select song_id from public.song_favorites', 'vê os próprios favoritos');
delete from public.song_favorites where song_id = 'f2000000-0000-4000-8000-000000000001';
select is_empty('select song_id from public.song_favorites', 'remove o próprio favorito');

select * from finish();
rollback;
