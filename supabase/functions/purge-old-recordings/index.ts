/**
 * Edge Function `purge-old-recordings`: apaga gravações de ensaio com mais de 90 dias e
 * arquivos "órfãos" do bucket (upload que não terminou), sempre PELA API DO STORAGE — nunca
 * apagando direto de storage.objects (o Storage precisa saber para liberar o espaço).
 * Áudios de referência não expiram.
 *
 * Chamada todo dia pelo workflow agendado `.github/workflows/purge-recordings.yml`.
 * Proteção: segredo próprio no cabeçalho `x-cron-secret` (variável CRON_SECRET da função; não é
 * um JWT de usuário, por isso verify_jwt = false no config.toml). Sem o segredo certo: 401.
 * `?dry_run=1` só lista o que seria apagado.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.119.1';

const RETENTION_DAYS = 90;
const BATCH = 100;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** Comparação em tempo constante (não vaza, pelo tempo de resposta, quanto do segredo acertou). */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido.' });

  const expected = Deno.env.get('CRON_SECRET') ?? '';
  // Segredo curto demais (ou não configurado) = função desligada.
  if (expected.length < 32) return json(503, { error: 'CRON_SECRET não configurado.' });
  if (!safeEqual(req.headers.get('x-cron-secret') ?? '', expected)) {
    return json(401, { error: 'Não autorizado.' });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json(500, { error: 'Variáveis do Supabase ausentes.' });
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc('audio_files_to_purge', { p_days: RETENTION_DAYS });
  if (error) {
    console.error('purge: audio_files_to_purge', error.message);
    return json(500, { error: 'Não foi possível listar os arquivos.' });
  }
  const items = (data ?? []) as { storage_path: string; reason: string }[];
  const paths = [...new Set(items.map((i) => i.storage_path))];

  if (new URL(req.url).searchParams.get('dry_run') === '1') {
    return json(200, { dryRun: true, toDelete: items });
  }

  let removedFiles = 0;
  const failures: string[] = [];
  for (let i = 0; i < paths.length; i += BATCH) {
    const batch = paths.slice(i, i + BATCH);
    const { data: removed, error: removeError } = await admin.storage.from('audios').remove(batch);
    if (removeError) {
      failures.push(...batch);
      console.error('purge: storage.remove', removeError.message);
      continue;
    }
    removedFiles += removed?.length ?? 0;
    // Só apaga o registro do que o Storage aceitou apagar (ou que já não existia).
    const { error: rowError } = await admin.from('media_files').delete().in('storage_path', batch);
    if (rowError) console.error('purge: media_files.delete', rowError.message);
  }

  const result = {
    retentionDays: RETENTION_DAYS,
    candidates: paths.length,
    removedFiles,
    failures: failures.length,
  };
  console.log('purge', JSON.stringify(result));
  return json(failures.length ? 207 : 200, result);
});
