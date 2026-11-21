-- =============================================================================
-- Áudios (migration 20261123090000_audio.sql): bucket "audios", media_files (RLS) e policies
-- de storage.objects. Apagar arquivo é pela API do Storage (testado no E2E); aqui se testa
-- quem pode registrar, ler e apagar os registros, e quem pode enviar/ler arquivos no bucket.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

select set_config('request.jwt.claims', '', true);

insert into auth.users (id, email, instance_id, aud, role) values
  ('b2000000-0000-4000-8000-000000000001', 'adm@audio.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('b2000000-0000-4000-8000-000000000002', 'isa@audio.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('b2000000-0000-4000-8000-000000000003', 'leo@audio.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
update public.profiles set access_role = 'admin' where id = 'b2000000-0000-4000-8000-000000000001';

insert into public.events (id, type, title, starts_at) values
  ('b3000000-0000-4000-8000-000000000001', 'ensaio', 'Ensaio áudio', now()),
  ('b3000000-0000-4000-8000-000000000002', 'culto', 'Culto áudio', now());
insert into public.songs (id, title) values ('b4000000-0000-4000-8000-000000000001', 'Música áudio');

-- ---------------------------------------------------------------------------
-- Bucket
-- ---------------------------------------------------------------------------
select is(
  (select row(public, file_size_limit, allowed_mime_types)::text from storage.buckets where id = 'audios'),
  row(false, 47185920::bigint, array['audio/*'])::text,
  'bucket "audios": privado, 45 MB por arquivo, só audio/*'
);
select ok(
  exists (select 1 from public.role_permissions where role = 'admin' and permission_key = 'media.manage')
  and not exists (select 1 from public.role_permissions where role = 'member' and permission_key = 'media.manage'),
  'media.manage: só admin'
);

-- ---------------------------------------------------------------------------
-- Integrante (Isa)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.media_files (kind, event_id, storage_path, mime_type, size_bytes, duration_seconds, created_by)
    values ('rehearsal', 'b3000000-0000-4000-8000-000000000001',
            'rehearsal/b3000000-0000-4000-8000-000000000001/isa.webm', 'audio/webm', 1000, 3.5,
            'b2000000-0000-4000-8000-000000000002')$$,
  'integrante registra gravação do ensaio'
);
select lives_ok(
  $$insert into public.media_files (kind, song_id, storage_path, mime_type, size_bytes, created_by)
    values ('reference', 'b4000000-0000-4000-8000-000000000001',
            'reference/b4000000-0000-4000-8000-000000000001/ref.mp3', 'audio/mpeg', 2000,
            'b2000000-0000-4000-8000-000000000002')$$,
  'integrante registra áudio de referência da música'
);
select throws_ok(
  $$insert into public.media_files (kind, event_id, storage_path, mime_type, size_bytes, created_by)
    values ('rehearsal', 'b3000000-0000-4000-8000-000000000002',
            'rehearsal/b3000000-0000-4000-8000-000000000002/x.webm', 'audio/webm', 1000,
            'b2000000-0000-4000-8000-000000000002')$$,
  '42501', null,
  'gravação só em evento do tipo ensaio'
);
select throws_ok(
  $$insert into public.media_files (kind, event_id, storage_path, mime_type, size_bytes, created_by)
    values ('rehearsal', 'b3000000-0000-4000-8000-000000000001',
            'rehearsal/b3000000-0000-4000-8000-000000000001/y.webm', 'audio/webm', 1000,
            'b2000000-0000-4000-8000-000000000003')$$,
  '42501', null,
  'não registra áudio em nome de outra pessoa'
);
select throws_ok(
  $$insert into public.media_files (kind, event_id, storage_path, mime_type, size_bytes, created_by)
    values ('rehearsal', 'b3000000-0000-4000-8000-000000000001',
            'outra/pasta/z.webm', 'audio/webm', 1000, 'b2000000-0000-4000-8000-000000000002')$$,
  '23514', null,
  'caminho no bucket tem de seguir tipo/alvo/arquivo'
);
select throws_ok(
  $$insert into public.media_files (kind, event_id, storage_path, mime_type, size_bytes, created_by)
    values ('rehearsal', 'b3000000-0000-4000-8000-000000000001',
            'rehearsal/b3000000-0000-4000-8000-000000000001/grande.webm', 'audio/webm', 47185921,
            'b2000000-0000-4000-8000-000000000002')$$,
  '23514', null,
  'registro acima de 45 MB é recusado'
);
select throws_ok(
  $$insert into public.media_files (kind, song_id, storage_path, mime_type, size_bytes, created_by)
    values ('reference', 'b4000000-0000-4000-8000-000000000001',
            'reference/b4000000-0000-4000-8000-000000000001/v.mp4', 'video/mp4', 1000,
            'b2000000-0000-4000-8000-000000000002')$$,
  '23514', null,
  'só tipos audio/*'
);
select throws_ok(
  $$select public.get_storage_usage()$$, '42501', null,
  'integrante não vê o espaço usado'
);
select throws_ok(
  $$select * from public.audio_files_to_purge(90)$$, '42501', null,
  'integrante não executa a lista de limpeza'
);
-- Storage: integrante envia arquivo no bucket, nas pastas certas
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('audios', 'rehearsal/b3000000-0000-4000-8000-000000000001/isa.webm',
            'b2000000-0000-4000-8000-000000000002')$$,
  'integrante envia arquivo para o bucket (pasta rehearsal)'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('audios', 'outra/coisa.webm', 'b2000000-0000-4000-8000-000000000002')$$,
  '42501', null,
  'bucket recusa pasta fora de rehearsal/reference'
);

-- ---------------------------------------------------------------------------
-- Outro integrante (Leo): lê, mas não apaga o que é da Isa
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"b2000000-0000-4000-8000-000000000003","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.media_files where created_by = 'b2000000-0000-4000-8000-000000000002'),
  2,
  'outro integrante vê os áudios (lista e player)'
);
select isnt_empty(
  $$select 1 from storage.objects where bucket_id = 'audios' and name like 'rehearsal/%'$$,
  'outro integrante lê o arquivo no bucket'
);
delete from public.media_files where created_by = 'b2000000-0000-4000-8000-000000000002';
select is(
  (select count(*)::int from public.media_files where created_by = 'b2000000-0000-4000-8000-000000000002'),
  2,
  'outro integrante NÃO apaga áudio da Isa (RLS ignora o DELETE)'
);
select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'audios' and name like 'rehearsal/%'
     and (owner_id = (select auth.uid())::text or public.has_permission('media.manage'))),
  0,
  'pela policy de apagar do bucket, o arquivo da Isa não é "dele"'
);

-- ---------------------------------------------------------------------------
-- Isa apaga o próprio registro; admin apaga o de qualquer um
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"b2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
delete from public.media_files where storage_path like 'reference/%' and created_by = 'b2000000-0000-4000-8000-000000000002';
select is(
  (select count(*)::int from public.media_files where storage_path like 'reference/%'),
  0,
  'autora apaga o próprio áudio'
);

select set_config('request.jwt.claims',
  '{"sub":"b2000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select ok(
  (public.get_storage_usage() ->> 'limit_bytes')::bigint = 1073741824,
  'admin vê o espaço usado (limite de 1 GB)'
);
delete from public.media_files where storage_path like 'rehearsal/%';
select is(
  (select count(*)::int from public.media_files),
  0,
  'admin apaga áudio de qualquer pessoa'
);

-- ---------------------------------------------------------------------------
-- Anônimo e service_role
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$select id from public.media_files$$, '42501', null,
  'anônimo não lê media_files'
);

reset role;
set local role service_role;
select lives_ok(
  $$select * from public.audio_files_to_purge(90)$$,
  'service_role (Edge Function de limpeza) executa a lista de limpeza'
);

select * from finish();
rollback;
