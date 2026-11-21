-- =============================================================================
-- Modelo ADVOP (migration 20261122090000_advop_roles_songs.sql):
-- perfis admin/member, grupos vocal/instrumental, permissões padrão, cadastro/edição/arquivo
-- de música e Atividade recente (history.view_all).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(30);

select set_config('request.jwt.claims', '', true);

insert into auth.users (id, email, instance_id, aud, role) values
  ('a1000000-0000-4000-8000-000000000001', 'adm@advop.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('a1000000-0000-4000-8000-000000000002', 'membro@advop.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
update public.profiles set access_role = 'admin', full_name = 'Admin Teste'
  where id = 'a1000000-0000-4000-8000-000000000001';
update public.profiles set full_name = 'Membro Teste'
  where id = 'a1000000-0000-4000-8000-000000000002';

insert into public.events (id, type, title, starts_at) values
  ('a3000000-0000-4000-8000-000000000001', 'ensaio', 'Ensaio teste', now() + interval '1 day');
insert into public.ministry_functions (name, section) values ('Teste vocal', 'vocal')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Configuração
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.permissions where key in ('songs.manage', 'history.view_all')),
  2,
  'permissões novas existem (songs.manage, history.view_all)'
);
select is(
  (select array_agg(permission_key::text order by permission_key) from public.role_permissions where role = 'member'),
  array['chords.edit_official', 'songs.manage', 'songs.set_official_key'],
  'padrão do integrante: cifra, tom oficial e cadastro de música'
);
select is(
  (select count(*)::int from public.role_permissions where role = 'admin'),
  (select count(*)::int from public.permissions),
  'admin tem todas as permissões'
);
select is(
  (select count(*)::int from public.role_permissions where role = 'leader')
  + (select count(*)::int from public.profiles where access_role = 'leader'),
  0,
  'perfil "leader" não é mais usado (nem perfis nem permissões)'
);
select throws_ok(
  $$update public.profiles set access_role = 'leader' where id = 'a1000000-0000-4000-8000-000000000002'$$,
  '23514', null,
  'CHECK impede voltar a usar "leader"'
);
select is(
  (select section from public.ministry_functions where name = 'Vocal principal'),
  'vocal',
  'Vocal principal é do grupo vocal'
);
select is(
  (select section from public.ministry_functions where name = 'Violão'),
  'instrumental',
  'Violão é do grupo instrumental'
);
select throws_ok(
  $$update public.ministry_functions set section = 'outro' where name = 'Teste vocal'$$,
  '23514', null,
  'section só aceita vocal ou instrumental'
);

-- ---------------------------------------------------------------------------
-- INTEGRANTE
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select lives_ok(
  $$select public.create_song('Canção de teste (exemplo)', 'Autor fictício', 'Louvor', 'G', 'A',
      null, 'obs', E'Linha um\nLinha dois', E'{key: G}\n[G]Linha um\n[D]Linha dois')$$,
  'integrante cadastra música com letra e cifra (create_song)'
);
select is(
  (select row(s.official_key, c.review_status, l.content)::text
   from public.songs s
   join public.song_chords c on c.song_id = s.id
   join public.song_lyrics l on l.song_id = s.id
   where s.title = 'Canção de teste (exemplo)'),
  row('A', 'official', E'Linha um\nLinha dois')::text,
  'música gravada com tom oficial, cifra oficial e letra'
);
select is(
  (select array_agg(field order by field) from public.song_versions v
   join public.songs s on s.id = v.song_id
   where s.title = 'Canção de teste (exemplo)' and v.change_type = 'create'),
  array['chords', 'lyrics', 'metadata', 'official_key'],
  'cadastro entra no histórico (dados, tom, letra e cifra)'
);
select lives_ok(
  $$update public.songs set title = 'Canção de teste editada (exemplo)', artist = 'Outro autor'
    where title = 'Canção de teste (exemplo)'$$,
  'integrante edita os dados da música'
);
select is(
  (select count(*)::int from public.song_versions v join public.songs s on s.id = v.song_id
   where s.title = 'Canção de teste editada (exemplo)' and v.field = 'metadata' and v.change_type = 'update'),
  1,
  'edição dos dados entra no histórico'
);
update public.song_chords set content = E'{key: G}\n[G]Linha um editada'
where song_id = (select id from public.songs where title = 'Canção de teste editada (exemplo)');
select is(
  (select c.content from public.song_chords c join public.songs s on s.id = c.song_id
   where s.title = 'Canção de teste editada (exemplo)'),
  E'{key: G}\n[G]Linha um editada',
  'integrante edita a cifra'
);
select lives_ok(
  $$update public.songs set official_key = 'B' where title = 'Canção de teste editada (exemplo)'$$,
  'integrante muda o tom oficial'
);
select throws_ok(
  $$update public.songs set archived_at = now() where title = 'Canção de teste editada (exemplo)'$$,
  '42501', 'Sem permissão para arquivar músicas.',
  'integrante NÃO arquiva'
);
delete from public.songs where title = 'Canção de teste editada (exemplo)';
select isnt_empty(
  $$select 1 from public.songs where title = 'Canção de teste editada (exemplo)'$$,
  'integrante NÃO exclui música (RLS ignora o DELETE)'
);
select throws_ok(
  $$update public.songs set created_by = null where title = 'Canção de teste editada (exemplo)'$$,
  '42501', null,
  'ninguém altera quem cadastrou a música'
);
select throws_ok(
  $$select public.restore_song_version((select id from public.song_versions limit 1))$$,
  '42501', null,
  'integrante NÃO restaura versões'
);
select throws_ok(
  $$insert into public.event_assignments (event_id, user_id, function_id)
    values ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002',
            (select id from public.ministry_functions where name = 'Teste vocal'))$$,
  '42501', null,
  'integrante NÃO monta escala'
);
select throws_ok(
  $$select * from public.get_recent_activity()$$,
  '42501', null,
  'integrante NÃO vê a atividade de todo o repertório'
);
select is_empty('select id from public.audit_logs', 'integrante não lê a auditoria');
select isnt_empty(
  $$select v.id from public.song_versions v join public.songs s on s.id = v.song_id
    where s.title = 'Canção de teste editada (exemplo)'$$,
  'o histórico de cada música continua visível para o integrante'
);

-- ---------------------------------------------------------------------------
-- ADMIN
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select ok(
  exists (select 1 from public.get_recent_activity()
          where song_title = 'Canção de teste editada (exemplo)' and actor_name = 'Membro Teste'),
  'admin vê na atividade recente as alterações do integrante, com nome'
);
select is(
  (select count(*)::int from public.get_recent_activity(p_actor => 'a1000000-0000-4000-8000-000000000001')),
  0,
  'filtro por pessoa: o admin ainda não alterou nada'
);
select is(
  (select count(distinct song_id)::int from public.get_recent_activity(
     p_song => (select id from public.songs where title = 'Canção de teste editada (exemplo)'))),
  1,
  'filtro por música'
);
select lives_ok(
  $$update public.songs set archived_at = now() where title = 'Canção de teste editada (exemplo)'$$,
  'admin arquiva música'
);
select ok(
  exists (select 1 from public.get_recent_activity(p_actor => 'a1000000-0000-4000-8000-000000000001')
          where kind = 'audit' and action = 'archive_song'),
  'arquivamento aparece na atividade recente'
);
select is_empty(
  $$select id from public.search_songs('Canção de teste editada')$$,
  'música arquivada sai da busca do repertório'
);

-- ---------------------------------------------------------------------------
-- ANÔNIMO
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$select * from public.get_recent_activity()$$,
  '42501', null,
  'anônimo não executa get_recent_activity()'
);

select * from finish();
rollback;
