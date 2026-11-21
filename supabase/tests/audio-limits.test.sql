-- =============================================================================
-- Áudios: nome (label), limite de 3 referências por música e bloqueio a 90% de 1 GB
-- (migration 20261125090000_audio_labels_limits.sql).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(24);

select set_config('request.jwt.claims', '', true);

insert into auth.users (id, email, instance_id, aud, role) values
  ('b6000000-0000-4000-8000-000000000001', 'adm@limite.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('b6000000-0000-4000-8000-000000000002', 'isa@limite.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('b6000000-0000-4000-8000-000000000003', 'leo@limite.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
update public.profiles set access_role = 'admin' where id = 'b6000000-0000-4000-8000-000000000001';

insert into public.events (id, type, title, starts_at) values
  ('b7000000-0000-4000-8000-000000000001', 'ensaio', 'Ensaio limite', now());
insert into public.songs (id, title) values
  ('b8000000-0000-4000-8000-000000000001', 'Música limite'),
  ('b8000000-0000-4000-8000-000000000002', 'Outra música limite');

-- Estrutura
select has_column('public', 'media_files', 'label', 'media_files.label existe');
select has_trigger('public', 'media_files', 'media_files_enforce_limits', 'trigger de limites');

-- ---------------------------------------------------------------------------
-- Limite de 3 áudios de referência por música
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b6000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.media_files (kind, song_id, storage_path, mime_type, size_bytes, created_by, label)
    values
      ('reference', 'b8000000-0000-4000-8000-000000000001', 'reference/b8000000-0000-4000-8000-000000000001/1.mp3', 'audio/mpeg', 1000, 'b6000000-0000-4000-8000-000000000002', 'Voz guia'),
      ('reference', 'b8000000-0000-4000-8000-000000000001', 'reference/b8000000-0000-4000-8000-000000000001/2.mp3', 'audio/mpeg', 1000, 'b6000000-0000-4000-8000-000000000002', null),
      ('reference', 'b8000000-0000-4000-8000-000000000001', 'reference/b8000000-0000-4000-8000-000000000001/3.mp3', 'audio/mpeg', 1000, 'b6000000-0000-4000-8000-000000000002', 'Arranjo')$$,
  'até 3 áudios de referência por música'
);
select throws_ok(
  $$insert into public.media_files (kind, song_id, storage_path, mime_type, size_bytes, created_by)
    values ('reference', 'b8000000-0000-4000-8000-000000000001', 'reference/b8000000-0000-4000-8000-000000000001/4.mp3', 'audio/mpeg', 1000, 'b6000000-0000-4000-8000-000000000002')$$,
  'P0001', 'Esta música já tem 3 áudios de referência. Apague um para enviar outro.',
  'o quarto áudio de referência é recusado com mensagem em português'
);
select throws_ok(
  $$select public.check_audio_upload('reference', 'b8000000-0000-4000-8000-000000000001')$$,
  'P0001', 'Esta música já tem 3 áudios de referência. Apague um para enviar outro.',
  'o app é avisado antes de enviar o arquivo'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('audios', 'reference/b8000000-0000-4000-8000-000000000001/4.mp3', 'b6000000-0000-4000-8000-000000000002')$$,
  '42501', null,
  'o bucket também recusa o quarto arquivo da música'
);
select lives_ok(
  $$select public.check_audio_upload('reference', 'b8000000-0000-4000-8000-000000000002')$$,
  'outra música continua aceitando'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('audios', 'reference/b8000000-0000-4000-8000-000000000002/1.mp3', 'b6000000-0000-4000-8000-000000000002')$$,
  'bucket aceita arquivo de outra música'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('audios', 'reference/nao-e-uuid/1.mp3', 'b6000000-0000-4000-8000-000000000002')$$,
  '42501', null,
  'bucket recusa pasta de música inválida'
);

-- ---------------------------------------------------------------------------
-- Nome (label): autor ou admin editam; só a coluna label
-- ---------------------------------------------------------------------------
update public.media_files set label = 'Voz guia (Isa)' where storage_path like '%/2.mp3';
select is(
  (select label from public.media_files where storage_path like '%/2.mp3'),
  'Voz guia (Isa)',
  'autora dá nome ao próprio áudio'
);
select throws_ok(
  $$update public.media_files set storage_path = 'reference/x/y.mp3' where storage_path like '%/2.mp3'$$,
  '42501', null,
  'só a coluna label pode ser alterada'
);
select throws_ok(
  $$update public.media_files set label = repeat('a', 61) where storage_path like '%/2.mp3'$$,
  '23514', null,
  'nome com mais de 60 caracteres é recusado'
);
select throws_ok(
  $$update public.media_files set label = '   ' where storage_path like '%/2.mp3'$$,
  '23514', null,
  'nome em branco é recusado (use null para tirar o nome)'
);

select set_config('request.jwt.claims',
  '{"sub":"b6000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
update public.media_files set label = 'Do Leo' where storage_path like '%/1.mp3';
select is(
  (select label from public.media_files where storage_path like '%/1.mp3'),
  'Voz guia',
  'outro integrante não renomeia áudio da Isa (RLS ignora)'
);

select set_config('request.jwt.claims',
  '{"sub":"b6000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
update public.media_files set label = 'Ensaio' where storage_path like '%/3.mp3';
select is(
  (select label from public.media_files where storage_path like '%/3.mp3'),
  'Ensaio',
  'admin renomeia áudio de qualquer pessoa'
);
select is(
  (select array_agg(coalesce(label, '-') order by storage_path) from public.media_files
   where song_id = 'b8000000-0000-4000-8000-000000000001'),
  array['Voz guia', 'Voz guia (Isa)', 'Ensaio'],
  'nomes gravados como esperado'
);

-- Apagar um libera a vaga
select set_config('request.jwt.claims',
  '{"sub":"b6000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
delete from public.media_files where storage_path like '%/b8000000-0000-4000-8000-000000000001/1.mp3';
select lives_ok(
  $$insert into public.media_files (kind, song_id, storage_path, mime_type, size_bytes, created_by)
    values ('reference', 'b8000000-0000-4000-8000-000000000001', 'reference/b8000000-0000-4000-8000-000000000001/5.mp3', 'audio/mpeg', 1000, 'b6000000-0000-4000-8000-000000000002')$$,
  'depois de apagar um, cabe outro'
);

-- ---------------------------------------------------------------------------
-- Bloqueio a 90% de 1 GB
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select public.check_audio_upload('rehearsal', 'b7000000-0000-4000-8000-000000000001')$$,
  'abaixo de 90%: envio liberado'
);

-- Arquivo "grande" já no bucket (como postgres), levando o uso a 90%.
reset role;
select set_config('request.jwt.claims', '', true);
insert into storage.objects (bucket_id, name, owner_id, metadata)
values ('audios', 'rehearsal/b7000000-0000-4000-8000-000000000001/enorme.webm',
        'b6000000-0000-4000-8000-000000000001',
        jsonb_build_object('size', public.audio_upload_block_bytes()));

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b6000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok(
  $$select public.check_audio_upload('rehearsal', 'b7000000-0000-4000-8000-000000000001')$$,
  'P0001',
  'O espaço dos áudios passou de 90% de 1 GB. Novos envios estão bloqueados até um admin apagar áudios antigos.',
  'a partir de 90%: o app é avisado antes de enviar'
);
select throws_ok(
  $$insert into public.media_files (kind, event_id, storage_path, mime_type, size_bytes, created_by)
    values ('rehearsal', 'b7000000-0000-4000-8000-000000000001', 'rehearsal/b7000000-0000-4000-8000-000000000001/novo.webm', 'audio/webm', 1000, 'b6000000-0000-4000-8000-000000000002')$$,
  'P0001', null,
  'a partir de 90%: gravação de ensaio nova é recusada'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('audios', 'reference/b8000000-0000-4000-8000-000000000002/2.mp3', 'b6000000-0000-4000-8000-000000000002')$$,
  '42501', null,
  'a partir de 90%: o bucket recusa arquivo novo (referência também)'
);

select set_config('request.jwt.claims',
  '{"sub":"b6000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(
  (public.get_storage_usage() ->> 'block_bytes')::bigint,
  966367641::bigint,
  'admin vê o ponto de bloqueio (90% de 1 GB) em Configurações'
);

-- Funções internas não ficam expostas; anônimo não consulta
select throws_ok(
  $$select public.audio_upload_problem('reference', 'b8000000-0000-4000-8000-000000000001', null)$$,
  '42501', null,
  'regra interna não é exposta pela API'
);
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$select public.check_audio_upload('reference', 'b8000000-0000-4000-8000-000000000002')$$,
  '42501', null,
  'anônimo não consulta'
);

select * from finish();
rollback;
