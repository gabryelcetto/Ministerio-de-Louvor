-- =============================================================================
-- Comunicados com público (destinatários), leituras e lembrete (Fase G, itens 1 e 2).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(31);

-- ---------------------------------------------------------------------------
-- Preparação (como postgres)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '', true);

insert into public.permissions (key, description) values ('announcements.manage', 't')
on conflict (key) do nothing;
insert into public.role_permissions (role, permission_key) values ('admin', 'announcements.manage')
on conflict do nothing;
insert into public.ministry_functions (name, section) values
  ('T vocal', 'vocal'), ('T bateria', 'instrumental')
on conflict (name) do nothing;

insert into auth.users (id, email, instance_id, aud, role) values
  ('a1000000-0000-4000-8000-000000000001', 'adm@t.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('a1000000-0000-4000-8000-000000000002', 'cantora@t.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('a1000000-0000-4000-8000-000000000003', 'baterista@t.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('a1000000-0000-4000-8000-000000000004', 'inativo@t.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

update public.profiles set access_role = 'admin', full_name = 'Adm'
where id = 'a1000000-0000-4000-8000-000000000001';
update public.profiles set full_name = 'Cantora' where id = 'a1000000-0000-4000-8000-000000000002';
update public.profiles set full_name = 'Baterista' where id = 'a1000000-0000-4000-8000-000000000003';
update public.profiles set full_name = 'Inativo', status = 'inactive'
where id = 'a1000000-0000-4000-8000-000000000004';

insert into public.member_functions (user_id, function_id)
select 'a1000000-0000-4000-8000-000000000002', id from public.ministry_functions where name = 'T vocal';
insert into public.member_functions (user_id, function_id)
select u, id from public.ministry_functions,
  unnest(array['a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000004']::uuid[]) u
where name = 'T bateria';

-- ---------------------------------------------------------------------------
-- Sem permissão: não publica, não edita, não exclui
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select throws_ok(
  $$select public.save_announcement(null, 'Oi', 'Texto', '{"type":"all"}')$$,
  '42501', null, 'integrante sem announcements.manage não publica');
select throws_ok(
  $$insert into public.announcements (title) values ('Direto')$$,
  '42501', null, 'insert direto na tabela é negado (só pela RPC)');
select throws_ok(
  $$select public.preview_announcement_audience('{"type":"all"}')$$,
  '42501', null, 'integrante não vê a contagem do público');

-- ---------------------------------------------------------------------------
-- Admin publica para o grupo Cantores
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select is(
  public.preview_announcement_audience('{"type":"groups","sections":["vocal"]}'),
  1, 'prévia: "Vai para 1 pessoa" (só a cantora)');
select is(
  public.preview_announcement_audience('{"type":"groups","sections":["instrumental"]}'),
  1, 'inativo não conta no público');
select throws_ok(
  $$select public.save_announcement(null, 'Ninguém', '', '{"type":"users","user_ids":[]}')$$,
  '22023', null, 'público vazio é recusado');
select throws_ok(
  $$select public.save_announcement(null, '   ', '', '{"type":"all"}')$$,
  '22023', null, 'título em branco é recusado');

select lives_ok(
  $$select set_config('t.vocal', public.save_announcement(null, 'Só cantores', 'Ensaio de vozes', '{"type":"groups","sections":["vocal"]}')::text, true)$$,
  'admin publica para Cantores');

reset role;
select is(
  (select array_agg(user_id) from public.announcement_recipients
   where announcement_id = current_setting('t.vocal')::uuid),
  array['a1000000-0000-4000-8000-000000000002'::uuid],
  'destinatário gravado: só a cantora');
select is(
  (select count(*)::int from public.notifications
   where link = '/comunicados/' || current_setting('t.vocal')),
  1, 'uma notificação, só para a destinatária');
select is(
  (select user_id from public.notifications where link = '/comunicados/' || current_setting('t.vocal')),
  'a1000000-0000-4000-8000-000000000002'::uuid, 'a notificação é da cantora');

-- ---------------------------------------------------------------------------
-- Quem lê
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is_empty(
  format('select id from public.announcements where id = %L', current_setting('t.vocal')),
  'baterista (fora do público) não lê');
select throws_ok(
  format('select public.mark_announcement_read(%L)', current_setting('t.vocal')),
  'P0002', null, 'fora do público não registra leitura');
select throws_ok(
  format('insert into public.announcement_reads (announcement_id) values (%L)', current_setting('t.vocal')),
  '42501', null, 'fora do público não insere leitura direto');
select isnt_empty(
  'select id from public.announcements where audience = ''all''',
  'comunicados para todos continuam visíveis');

select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select isnt_empty(
  format('select id from public.announcements where id = %L', current_setting('t.vocal')),
  'cantora (no público) lê');
select lives_ok(
  format('select public.mark_announcement_read(%L)', current_setting('t.vocal')),
  'abrir o detalhe registra a leitura');
select is(
  (select count(*)::int from public.notifications
   where link = '/comunicados/' || current_setting('t.vocal') and read_at is null),
  0, 'e marca a notificação como lida');
select throws_ok(
  format('select public.get_announcement_audience_status(%L)', current_setting('t.vocal')),
  '42501', null, 'integrante não vê quem leu');
select throws_ok(
  format('insert into public.announcement_reads (announcement_id, user_id) values (%L, %L)',
    current_setting('t.vocal'), 'a1000000-0000-4000-8000-000000000003'),
  '42501', null, 'ninguém registra leitura em nome de outra pessoa');

-- Integrante só vê as próprias leituras
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is_empty('select user_id from public.announcement_reads',
  'integrante não lê as leituras dos outros');

-- ---------------------------------------------------------------------------
-- Admin: visto por, lembrete, edição e exclusão
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.get_announcement_audience_status(current_setting('t.vocal')::uuid)
   where read_at is not null),
  1, 'admin vê "Visto por 1 de 1"');

-- Muda o público para todos os ativos: só os NOVOS são avisados.
select lives_ok(
  format($$select public.save_announcement(%L, 'Só cantores', 'Ensaio de vozes', '{"type":"all"}')$$,
    current_setting('t.vocal')),
  'admin edita e muda o público');
reset role;
select is(
  (select array_agg(user_id order by user_id) from public.notifications
   where link = '/comunicados/' || current_setting('t.vocal') and type = 'announcement'),
  array['a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003']::uuid[],
  'edição avisa só o novo destinatário (a cantora não recebe de novo; o inativo nem o autor)');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(
  public.remind_announcement(current_setting('t.vocal')::uuid),
  2, 'lembrete vai para quem ainda não viu (admin e baterista)');
select throws_ok(
  format('select public.remind_announcement(%L)', current_setting('t.vocal')),
  'P0001', 'Já foi enviado um lembrete hoje. Tente de novo amanhã.',
  'segundo lembrete no mesmo dia é recusado');

-- Sem permissão não exclui
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok(
  format('select public.delete_announcement(%L)', current_setting('t.vocal')),
  '42501', null, 'integrante não exclui');
select throws_ok(
  format('select public.save_announcement(%L, %L, %L, %L)', current_setting('t.vocal'), 'X', 'Y', '{"type":"all"}'),
  '42501', null, 'integrante não edita');

select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok(
  format('select public.delete_announcement(%L)', current_setting('t.vocal')),
  'admin exclui');
reset role;
select is(
  (select count(*)::int from public.notifications where link = '/comunicados/' || current_setting('t.vocal')),
  0, 'as notificações do comunicado excluído somem');

-- ---------------------------------------------------------------------------
-- Anônimo
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$select public.save_announcement(null, 'x', 'y', '{"type":"all"}')$$,
  '42501', null, 'anônimo não executa save_announcement');

select * from finish();
rollback;
