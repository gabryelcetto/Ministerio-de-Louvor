-- =============================================================================
-- Listas longas: "Carregar mais" na Atividade recente (p_offset) — Fase G, item 13.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(4);

select set_config('request.jwt.claims', '', true);
insert into public.permissions (key, description) values ('history.view_all', 't')
on conflict (key) do nothing;
insert into public.role_permissions (role, permission_key) values ('admin', 'history.view_all')
on conflict do nothing;
insert into auth.users (id, email, instance_id, aud, role) values
  ('a4000000-0000-4000-8000-000000000001', 'adm@p.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
update public.profiles set access_role = 'admin' where id = 'a4000000-0000-4000-8000-000000000001';
insert into public.songs (id, title) values ('a5000000-0000-4000-8000-000000000001', 'Página');
insert into public.song_versions (song_id, field, new_value, change_type, changed_at)
select 'a5000000-0000-4000-8000-000000000001', 'lyrics', 'v' || g, 'update', now() - make_interval(mins => g)
from generate_series(1, 5) g;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.get_recent_activity(
     p_song => 'a5000000-0000-4000-8000-000000000001', p_limit => 3)),
  3, 'primeira página');
select is(
  (select count(*)::int from public.get_recent_activity(
     p_song => 'a5000000-0000-4000-8000-000000000001', p_limit => 3, p_offset => 3)),
  3, 'segunda página traz o resto (5 versões + o cadastro da música)');
select is(
  (select array_agg(version_id) from (
     select version_id from public.get_recent_activity(
       p_song => 'a5000000-0000-4000-8000-000000000001', p_limit => 3, p_offset => 3)) x)
  && (select array_agg(version_id) from (
     select version_id from public.get_recent_activity(
       p_song => 'a5000000-0000-4000-8000-000000000001', p_limit => 3)) y),
  false, 'as páginas não se repetem');
select is(
  (select count(*)::int from public.get_recent_activity(
     p_song => 'a5000000-0000-4000-8000-000000000001', p_offset => -5)),
  6, 'offset negativo vira zero');

select * from finish();
rollback;
