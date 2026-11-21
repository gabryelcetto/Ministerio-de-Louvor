// Confere pela API (sem a interface) que o banco recusa o que cada perfil não pode fazer.
// Simula alguém chamando o Supabase direto pelo console do navegador.
// Uso: API_URL=... ANON_KEY=... DEMO_PASSWORD=... node e2e/api-checks.mjs
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { makeWav } from './wav.mjs';

const { API_URL, ANON_KEY, DEMO_PASSWORD } = process.env;
const SONG = '00000000-0000-4000-8000-000000000001';
let failures = 0;

function check(ok, label, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function login(email) {
  const client = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return client;
}

// ---------------------------------------------------------------- integrante
const member = await login('integrante@demo.local');
// Modelo ADVOP: o integrante EDITA cifra e tom oficial (permissões padrão). As verificações
// disso ficam na música criada pela própria API (mais abaixo), sem mexer no seed.
{
  const { data: v } = await member
    .from('song_versions')
    .select('id')
    .eq('song_id', SONG)
    .limit(1)
    .single();
  const { error } = await member.rpc('restore_song_version', { version_id: v.id });
  check(
    error?.code === '42501',
    'integrante: restore_song_version é recusado',
    error?.message ?? 'sem erro',
  );
}
{
  const { error } = await member.from('profiles').select('phone');
  check(Boolean(error), 'integrante: coluna phone não é legível', error?.code ?? 'sem erro');
}
{
  const { data, error } = await member.rpc('get_member_contacts');
  check(
    !error && data.length === 1,
    'integrante: get_member_contacts devolve só o próprio telefone',
    `${data?.length} linhas`,
  );
}
{
  const { data } = await member.from('profiles').select('id, full_name');
  check((data?.length ?? 0) >= 3, 'integrante: vê os nomes dos colegas', `${data?.length} perfis`);
}
{
  const { data } = await member.from('notifications').select('user_id');
  const { data: me } = await member.auth.getUser();
  check(
    (data ?? []).every((n) => n.user_id === me.user.id),
    'integrante: só vê as próprias notificações',
    `${data?.length} notificações`,
  );
}
{
  const { error } = await member
    .from('events')
    .insert({ type: 'culto', title: 'x', starts_at: new Date().toISOString() })
    .select('id');
  check(error?.code === '42501', 'integrante: não cria eventos', error?.code ?? 'sem erro');
}

// ---------------------------------------------------------------- modelo ADVOP (integrante)
{
  const { data, error } = await member.rpc('get_recent_activity', {});
  check(
    error?.code === '42501',
    'integrante: get_recent_activity (atividade geral) é recusada',
    error?.message ?? `${data?.length} linhas`,
  );
}
{
  const { error } = await member
    .from('songs')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', SONG)
    .select('id');
  check(error?.code === '42501', 'integrante: não arquiva música', error?.message ?? 'sem erro');
}
{
  const { data: ev } = await member.from('events').select('id').limit(1).single();
  const { data: fn } = await member.from('ministry_functions').select('id').limit(1).single();
  const { data: me } = await member.auth.getUser();
  const { error } = await member
    .from('event_assignments')
    .insert({ event_id: ev.id, user_id: me.user.id, function_id: fn.id })
    .select('id');
  check(error?.code === '42501', 'integrante: não monta escala', error?.code ?? 'sem erro');
}
{
  const { error } = await member.from('audit_logs').select('id');
  const { data } = await member.from('audit_logs').select('id');
  check(!error && (data ?? []).length === 0, 'integrante: não lê a auditoria', `${data?.length}`);
}
{
  const { data } = await member.from('song_versions').select('id').eq('song_id', SONG);
  check(
    (data ?? []).length > 0,
    'integrante: histórico de cada música continua visível',
    `${data?.length}`,
  );
}
{
  const { data, error } = await member.rpc('my_permissions');
  const keys = [...(data ?? [])].sort().join(',');
  check(
    !error && keys === 'chords.edit_official,songs.manage,songs.set_official_key',
    'integrante: permissões padrão ADVOP',
    keys,
  );
}
{
  // Integrante cadastra música pela API (letra e cifra) e edita a cifra; o admin apaga depois
  // para não mudar a contagem do repertório usada pelos testes de tela.
  const { data: id, error } = await member.rpc('create_song', {
    p_title: 'Música da API (exemplo)',
    p_artist: '',
    p_category: '',
    p_original_key: 'G',
    p_official_key: 'G',
    p_media_url: '',
    p_notes: '',
    p_lyrics: 'Linha fictícia',
    p_chords: '{key: G}\n[G]Linha fictícia',
  });
  check(
    !error && typeof id === 'string',
    'integrante: cadastra música (create_song)',
    error?.message ?? '',
  );
  if (id) {
    const { data: upd, error: e2 } = await member
      .from('song_chords')
      .update({ content: '{key: G}\n[D]Editada' })
      .eq('song_id', id)
      .select('song_id');
    check(!e2 && upd.length === 1, 'integrante: edita a cifra da música nova', e2?.message ?? '');
    const { data: key, error: e3 } = await member
      .from('songs')
      .update({ official_key: 'A' })
      .eq('id', id)
      .select('official_key');
    check(
      !e3 && key?.[0]?.official_key === 'A',
      'integrante: muda o tom oficial da música nova',
      e3?.message ?? '',
    );
    globalThis.apiSongId = id;
  }
}

// ---------------------------------------------------------------- Lucas (antigo "líder")
const leader = await login('lider@demo.local');
{
  const { data, error } = await leader.rpc('get_member_contacts');
  check(
    !error && data.length === 1,
    'ex-líder (agora integrante): só o próprio telefone',
    `${data?.length} linhas`,
  );
}
{
  const { error } = await leader
    .from('profiles')
    .update({ access_role: 'admin' })
    .eq('id', (await leader.auth.getUser()).data.user.id)
    .select('id');
  check(error?.code === '42501', 'ex-líder: não se promove a admin', error?.code ?? 'sem erro');
}
{
  const { error } = await leader
    .from('profiles')
    .update({ access_role: 'leader' })
    .eq('id', (await leader.auth.getUser()).data.user.id)
    .select('id');
  check(Boolean(error), 'ninguém volta a ser "leader"', error?.code ?? 'sem erro');
}

// ---------------------------------------------------------------- Edge Function invite-member
const FN_URL = `${API_URL}/functions/v1/invite-member`;
const newMember = {
  fullName: 'Pessoa da API',
  displayName: '',
  email: 'api-cadastro@demo.local',
  accessRole: 'member',
  functionIds: [],
};

async function callInvite(client, body) {
  const { data: s } = client ? await client.auth.getSession() : { data: { session: null } };
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      ...(s.session ? { Authorization: `Bearer ${s.session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // corpo vazio
  }
  return { status: res.status, json };
}

{
  const r = await callInvite(null, newMember);
  check(r.status === 401, 'sem login: invite-member responde 401', `${r.status}`);
}
{
  const r = await callInvite(member, newMember);
  check(
    r.status === 403 && r.json?.error === 'Você não tem permissão para cadastrar integrantes.',
    'integrante: invite-member recusa (403, mensagem em português)',
    `${r.status} ${r.json?.error}`,
  );
}
{
  const r = await callInvite(leader, newMember);
  check(r.status === 403, 'líder sem members.manage: invite-member recusa', `${r.status}`);
}
const admin = await login('admin@demo.local');
{
  const { data, error } = await admin.rpc('get_recent_activity', { p_limit: 20 });
  check(
    !error &&
      data.some((r) => r.song_title === 'Música da API (exemplo)' && r.actor_name === 'Isa'),
    'admin: atividade recente mostra a música cadastrada pela integrante',
    error?.message ?? `${data?.length} linhas`,
  );
}
if (globalThis.apiSongId) {
  const { data, error } = await admin
    .from('songs')
    .delete()
    .eq('id', globalThis.apiSongId)
    .select('id');
  check(!error && data.length === 1, 'admin: apaga música (songs.delete)', error?.message ?? '');
}
{
  const r = await callInvite(admin, { ...newMember, email: 'nao-e-email' });
  check(
    r.status === 400 && r.json?.error === 'Informe um e-mail válido.',
    'dados inválidos: 400 com mensagem',
    `${r.status} ${r.json?.error}`,
  );
}
let created = null;
{
  const r = await callInvite(admin, newMember);
  created = r.json;
  check(
    r.status === 201 &&
      /^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/.test(r.json?.temporaryPassword ?? ''),
    'admin cadastra: 201 com senha provisória forte',
    `${r.status}`,
  );
}
{
  const r = await callInvite(admin, newMember);
  check(
    r.status === 409 && r.json?.error === 'Já existe uma conta com este e-mail.',
    'e-mail duplicado: 409 com mensagem',
    `${r.status} ${r.json?.error}`,
  );
}
if (created?.temporaryPassword) {
  const fresh = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error: loginError } = await fresh.auth.signInWithPassword({
    email: newMember.email,
    password: created.temporaryPassword,
  });
  check(!loginError, 'pessoa nova entra com a senha provisória', loginError?.message ?? '');
  {
    const { data } = await fresh
      .from('profiles')
      .select('must_change_password, access_role')
      .single();
    check(
      data?.must_change_password === true && data?.access_role === 'member',
      'conta nova: must_change_password = true, perfil member',
      JSON.stringify(data),
    );
  }
  {
    const { data } = await fresh.from('songs').select('id');
    check(
      (data ?? []).length === 0,
      'senha provisória: não lê nada (bloqueio no banco)',
      `${data?.length}`,
    );
  }
  {
    const { error } = await fresh
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', created.userId)
      .select('id');
    check(Boolean(error), 'não limpa a flag por UPDATE direto', error?.code ?? 'sem erro');
  }
  {
    const { error: e1 } = await fresh.auth.updateUser({ password: 'SenhaDaApi2026' });
    const { error: e2 } = await fresh.rpc('complete_password_change');
    const { data } = await fresh.from('songs').select('id');
    check(
      !e1 && !e2 && (data ?? []).length > 0,
      'troca a senha + complete_password_change: acesso liberado',
      e1?.message ?? e2?.message ?? `${data?.length} músicas`,
    );
  }
}

// ---------------------------------------------------------------- áudios (Storage)
{
  const ENSAIO = '10000000-0000-4000-8000-000000000001'; // "Ensaio geral" do seed
  const CULTO = '10000000-0000-4000-8000-000000000002';
  const wav = makeWav({ seconds: 2 });
  const isa = (await member.auth.getUser()).data.user.id;
  const bucket = (c) => c.storage.from('audios');

  // Integrante envia áudio de referência e registra
  const refPath = `reference/${SONG}/api-${Date.now()}.wav`;
  {
    const { error } = await bucket(member).upload(refPath, wav, { contentType: 'audio/wav' });
    const { error: e2 } = await member
      .from('media_files')
      .insert({
        kind: 'reference',
        song_id: SONG,
        storage_path: refPath,
        mime_type: 'audio/wav',
        size_bytes: wav.length,
        duration_seconds: 2,
        created_by: isa,
      })
      .select('id');
    check(
      !error && !e2,
      'áudio: integrante envia e registra referência',
      error?.message ?? e2?.message ?? '',
    );
  }
  {
    const { error } = await bucket(member).upload(
      `reference/${SONG}/texto.txt`,
      Buffer.from('não é áudio'),
      {
        contentType: 'text/plain',
      },
    );
    check(
      Boolean(error),
      'áudio: bucket recusa arquivo que não é audio/*',
      error?.message ?? 'aceitou',
    );
  }
  {
    const grande = makeWav({ minBytes: 46 * 1024 * 1024 });
    const { error } = await bucket(member).upload(`reference/${SONG}/grande.wav`, grande, {
      contentType: 'audio/wav',
    });
    check(
      Boolean(error),
      'áudio: bucket recusa arquivo acima de 45 MB',
      error?.message ?? 'aceitou',
    );
  }
  {
    const { error } = await bucket(member).upload(`outra/${Date.now()}.wav`, wav, {
      contentType: 'audio/wav',
    });
    check(
      Boolean(error),
      'áudio: bucket recusa pasta fora de rehearsal/reference',
      error?.message ?? 'aceitou',
    );
  }
  {
    const path = `rehearsal/${CULTO}/api.wav`;
    const { error } = await member
      .from('media_files')
      .insert({
        kind: 'rehearsal',
        event_id: CULTO,
        storage_path: path,
        mime_type: 'audio/wav',
        size_bytes: wav.length,
        created_by: isa,
      })
      .select('id');
    check(
      error?.code === '42501',
      'áudio: gravação só em evento do tipo ensaio',
      error?.code ?? 'aceitou',
    );
  }
  // Outro integrante (Lucas) não apaga o áudio da Isa — nem o arquivo, nem o registro
  {
    const { data, error } = await bucket(leader).remove([refPath]);
    const { data: still } = await bucket(member).download(refPath);
    check(
      !error && (data ?? []).length === 0 && Boolean(still),
      'áudio: outro integrante NÃO apaga o arquivo da Isa (API do Storage)',
      error?.message ?? `${data?.length} removidos`,
    );
    const { data: rows } = await leader
      .from('media_files')
      .delete()
      .eq('storage_path', refPath)
      .select('id');
    check(
      (rows ?? []).length === 0,
      'áudio: outro integrante NÃO apaga o registro da Isa',
      `${rows?.length}`,
    );
  }
  {
    const { error } = await member.rpc('get_storage_usage');
    check(
      error?.code === '42501',
      'áudio: integrante não vê o espaço usado',
      error?.code ?? 'sem erro',
    );
    const { data, error: e2 } = await admin.rpc('get_storage_usage');
    check(
      !e2 && Number(data?.total_bytes) > 0 && Number(data?.limit_bytes) === 1073741824,
      'áudio: admin vê o espaço usado do 1 GB',
      e2?.message ?? JSON.stringify(data),
    );
  }
  // A autora apaga o próprio áudio (arquivo pela API do Storage + registro)
  {
    const { data, error } = await bucket(member).remove([refPath]);
    const { data: rows } = await member
      .from('media_files')
      .delete()
      .eq('storage_path', refPath)
      .select('id');
    check(
      !error && data?.length === 1 && rows?.length === 1,
      'áudio: autora apaga o próprio áudio',
      error?.message ?? `${data?.length}/${rows?.length}`,
    );
  }

  // Limpeza automática: gravação de ensaio "com 100 dias" some; referência fica.
  const oldPath = `rehearsal/${ENSAIO}/antiga-${Date.now()}.wav`;
  const keepPath = `reference/${SONG}/fica-${Date.now()}.wav`;
  for (const [path, kind] of [
    [oldPath, 'rehearsal'],
    [keepPath, 'reference'],
  ]) {
    await bucket(member).upload(path, wav, { contentType: 'audio/wav' });
    await member.from('media_files').insert({
      kind,
      event_id: kind === 'rehearsal' ? ENSAIO : null,
      song_id: kind === 'reference' ? SONG : null,
      storage_path: path,
      mime_type: 'audio/wav',
      size_bytes: wav.length,
      created_by: isa,
    });
  }
  execSync(
    'docker exec -i supabase_db_ministerio-de-louvor psql -v ON_ERROR_STOP=1 -U postgres -d postgres',
    {
      input: `update public.media_files set created_at = now() - interval '100 days' where storage_path = '${oldPath}';`,
    },
  );
  const purgeUrl = `${API_URL}/functions/v1/purge-old-recordings`;
  {
    const res = await fetch(purgeUrl, { method: 'POST', headers: { 'x-cron-secret': 'errado' } });
    check(res.status === 401, 'limpeza: sem o segredo certo responde 401', `${res.status}`);
  }
  {
    const res = await fetch(purgeUrl, {
      method: 'POST',
      headers: { 'x-cron-secret': process.env.CRON_SECRET ?? '' },
    });
    const body = await res.json().catch(() => ({}));
    const { data: oldFile } = await bucket(member).download(oldPath);
    const { data: keepFile } = await bucket(member).download(keepPath);
    const { data: rows } = await member
      .from('media_files')
      .select('storage_path')
      .in('storage_path', [oldPath, keepPath]);
    check(
      res.status === 200 &&
        body.removedFiles >= 1 &&
        !oldFile &&
        Boolean(keepFile) &&
        rows?.length === 1 &&
        rows[0].storage_path === keepPath,
      'limpeza: apaga gravação de ensaio com mais de 90 dias (pela API do Storage) e mantém a referência',
      `${res.status} ${JSON.stringify(body)}`,
    );
  }
  // Tira o áudio de referência do teste
  await bucket(member).remove([keepPath]);
  await member.from('media_files').delete().eq('storage_path', keepPath);
}

if (failures) {
  console.log(`\n${failures} verificação(ões) falharam.`);
  process.exit(1);
}
console.log('\nTodas as verificações de API passaram.');
