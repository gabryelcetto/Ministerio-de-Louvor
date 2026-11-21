-- =============================================================================
-- Início: "Precisa de atenção" só para quem monta escala e comunicados por público (Fase G).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(7);

select set_config('request.jwt.claims', '', true);
insert into public.permissions (key, description) values ('schedules.manage', 't')
on conflict (key) do nothing;
insert into public.role_permissions (role, permission_key) values ('admin', 'schedules.manage')
on conflict do nothing;
insert into public.ministry_functions (name, section) values ('D violão', 'instrumental')
on conflict (name) do nothing;

insert into auth.users (id, email, instance_id, aud, role) values
  ('d1000000-0000-4000-8000-000000000001', 'adm@d.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('d1000000-0000-4000-8000-000000000002', 'membro@d.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
update public.profiles set access_role = 'admin' where id = 'd1000000-0000-4000-8000-000000000001';

-- Só os eventos deste teste contam.
delete from public.events;
insert into public.events (id, type, title, starts_at, status) values
  ('d2000000-0000-4000-8000-000000000001', 'culto', 'Culto sem nada', now() + interval '2 days', 'scheduled'),
  ('d2000000-0000-4000-8000-000000000002', 'ensaio', 'Ensaio com equipe', now() + interval '3 days', 'scheduled'),
  ('d2000000-0000-4000-8000-000000000003', 'culto', 'Culto cancelado', now() + interval '4 days', 'cancelled'),
  ('d2000000-0000-4000-8000-000000000004', 'culto', 'Culto longe', now() + interval '20 days', 'scheduled'),
  ('d2000000-0000-4000-8000-000000000005', 'evento', 'Evento sem equipe', now() + interval '5 days', 'scheduled');
insert into public.event_assignments (event_id, user_id, function_id)
select 'd2000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', id
from public.ministry_functions where name = 'D violão';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(
  (select array_agg(x ->> 'title' order by x ->> 'starts_at')
   from jsonb_array_elements(public.get_dashboard() -> 'attention') x),
  array['Culto sem nada', 'Evento sem equipe'],
  'admin vê as pendências dos próximos 14 dias (sem cancelado, sem o que está longe, ensaio com equipe ok)');
select is((public.get_dashboard() ->> 'attention_total')::int, 2, 'total de pendências');
select is(
  (select (x ->> 'no_team')::boolean and (x ->> 'no_songs')::boolean
   from jsonb_array_elements(public.get_dashboard() -> 'attention') x
   where x ->> 'title' = 'Culto sem nada'),
  true, 'culto sem equipe e sem repertório');
select is(
  (select (x ->> 'no_songs')::boolean
   from jsonb_array_elements(public.get_dashboard() -> 'attention') x
   where x ->> 'title' = 'Evento sem equipe'),
  false, 'evento (não culto) sem músicas não é pendência de repertório');

select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is(public.get_dashboard() -> 'attention', '[]'::jsonb, 'integrante não recebe as pendências');
select is((public.get_dashboard() ->> 'attention_total')::int, 0, 'nem o total');
select ok(public.get_dashboard() ? 'recent_announcements', 'o resto do Início continua lá');

select * from finish();
rollback;
