/**
 * Supabase de mentira para os testes de tela e de API (sem rede, sem banco).
 * - Tabelas em memória com filtros simples (eq, neq, in, is, gte, lte, gt, lt), ordem e limite.
 * - insert/update/upsert/delete alteram as tabelas e devolvem as linhas (como o `.select()`).
 * - rpc: valor fixo ou função dos argumentos.
 * - `fake.fail(...)`: força um erro numa tabela/RPC (para testar as mensagens).
 * Uso: vi.mock('@/services/supabase', async () => ({ supabase: (await import('@/test/fake-supabase')).fake.client }))
 */
import type { Session } from '@supabase/supabase-js';

type Row = Record<string, unknown>;
export interface FakeResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}
export interface Op {
  method: string;
  args: unknown[];
}
export interface Call {
  kind: 'from' | 'rpc';
  name: string;
  ops: Op[];
}
type RpcValue = unknown | ((args: Record<string, unknown>) => FakeResult);

export interface FakeState {
  tables: Record<string, Row[]>;
  rpc: Record<string, RpcValue>;
  session: Session | null;
  /** Resposta de signInWithPassword por senha (padrão: aceita qualquer uma). */
  passwords?: Record<string, string>;
}

const FILTERS = new Set(['eq', 'neq', 'in', 'is', 'gte', 'lte', 'gt', 'lt', 'not']);

function columnValue(row: Row, column: string): unknown {
  return row[column];
}

function applyFilters(rows: Row[], ops: Op[]): Row[] {
  let out = rows;
  for (const { method, args } of ops) {
    if (!FILTERS.has(method)) continue;
    const [column, a, b] = args as [string, unknown, unknown];
    // Filtro em relação aninhada (ex.: "event.starts_at") ou coluna ausente: ignora.
    if (column.includes('.')) continue;
    out = out.filter((row) => {
      if (!(column in row)) return true;
      const v = columnValue(row, column);
      switch (method) {
        case 'eq':
          return v === a;
        case 'neq':
          return v !== a;
        case 'in':
          return (a as unknown[]).includes(v);
        case 'is':
          return a === null ? v === null || v === undefined : v === a;
        case 'not':
          return a === 'is' && b === null ? v !== null && v !== undefined : true;
        case 'gte':
          return String(v) >= String(a);
        case 'lte':
          return String(v) <= String(a);
        case 'gt':
          return String(v) > String(a);
        case 'lt':
          return String(v) < String(a);
        default:
          return true;
      }
    });
  }
  return out;
}

function applyOrderLimit(rows: Row[], ops: Op[]): Row[] {
  let out = [...rows];
  for (const { method, args } of ops) {
    if (method === 'order') {
      const [column, opts] = args as [string, { ascending?: boolean } | undefined];
      const dir = opts?.ascending === false ? -1 : 1;
      out.sort((x, y) => {
        const a = x[column] as string | number;
        const b = y[column] as string | number;
        return a === b ? 0 : a > b ? dir : -dir;
      });
    }
    if (method === 'limit') out = out.slice(0, args[0] as number);
    if (method === 'range') out = out.slice(args[0] as number, (args[1] as number) + 1);
  }
  return out;
}

let idSeq = 0;
const newId = () => `00000000-0000-4000-8000-${String(++idSeq).padStart(12, '0')}`;

export function createFakeSupabase() {
  const state: FakeState = { tables: {}, rpc: {}, session: null };
  const calls: Call[] = [];
  const failures: { kind: Call['kind']; name: string; method?: string; error: unknown }[] = [];
  const authListeners = new Set<(event: string, session: Session | null) => void>();
  const invoke = {
    handler: (async () => ({ data: null, error: null })) as (
      name: string,
      options: { body?: unknown },
    ) => Promise<{ data: unknown; error: unknown }>,
  };

  function failureFor(call: Call) {
    return failures.find(
      (f) =>
        f.kind === call.kind &&
        f.name === call.name &&
        (!f.method || call.ops.some((o) => o.method === f.method)),
    );
  }

  function resolveFrom(call: Call): FakeResult {
    const table = (state.tables[call.name] ??= []);
    const write = call.ops.find((o) => ['insert', 'update', 'upsert', 'delete'].includes(o.method));
    const single = call.ops.some((o) => o.method === 'single');
    const maybe = call.ops.some((o) => o.method === 'maybeSingle');
    const selectOp = call.ops.find((o) => o.method === 'select');
    const head = (selectOp?.args[1] as { head?: boolean; count?: string } | undefined)?.head;
    let rows: Row[];

    if (write?.method === 'insert' || write?.method === 'upsert') {
      const payload = write.args[0];
      const list = (Array.isArray(payload) ? payload : [payload]) as Row[];
      const conflict = (write.args[1] as { onConflict?: string } | undefined)?.onConflict;
      rows = list.map((r) => {
        if (write.method === 'upsert' && conflict) {
          const existing = table.find((t) => t[conflict] === r[conflict]);
          if (existing) return Object.assign(existing, r);
        }
        const row = { id: newId(), created_at: new Date().toISOString(), ...r };
        table.push(row);
        return row;
      });
    } else if (write?.method === 'update') {
      rows = applyFilters(table, call.ops);
      for (const r of rows) Object.assign(r, write.args[0] as Row);
    } else if (write?.method === 'delete') {
      rows = applyFilters(table, call.ops);
      state.tables[call.name] = table.filter((r) => !rows.includes(r));
    } else {
      rows = applyOrderLimit(applyFilters(table, call.ops), call.ops);
    }

    if (head) return { data: null, count: rows.length, error: null };
    if (single) {
      return rows[0]
        ? { data: rows[0], error: null }
        : { data: null, error: { code: 'PGRST116', message: 'no rows' } };
    }
    if (maybe) return { data: rows[0] ?? null, error: null };
    return { data: rows, error: null, count: rows.length };
  }

  function resolveRpc(call: Call): FakeResult {
    const args = (call.ops[0]?.args[0] ?? {}) as Record<string, unknown>;
    const value = state.rpc[call.name];
    const base: FakeResult =
      typeof value === 'function'
        ? (value as (a: Record<string, unknown>) => FakeResult)(args)
        : { data: value ?? null, error: null };
    if (base.error || !Array.isArray(base.data)) {
      if (call.ops.some((o) => o.method === 'single'))
        return { ...base, data: Array.isArray(base.data) ? base.data[0] : base.data };
      return base;
    }
    const rows = applyOrderLimit(applyFilters(base.data as Row[], call.ops.slice(1)), call.ops);
    if (call.ops.some((o) => o.method === 'single')) return { data: rows[0] ?? null, error: null };
    return { data: rows, error: null };
  }

  function builder(call: Call): unknown {
    const proxy: unknown = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') {
            return (ok: (v: FakeResult) => unknown, fail?: (e: unknown) => unknown) => {
              const failure = failureFor(call);
              const result: FakeResult = failure
                ? { data: null, error: failure.error }
                : call.kind === 'from'
                  ? resolveFrom(call)
                  : resolveRpc(call);
              return Promise.resolve({ error: null, ...result }).then(ok, fail);
            };
          }
          return (...args: unknown[]) => {
            call.ops.push({ method: String(prop), args });
            return proxy;
          };
        },
      },
    );
    return proxy;
  }

  const client = {
    from(name: string) {
      const call: Call = { kind: 'from', name, ops: [] };
      calls.push(call);
      return builder(call);
    },
    rpc(name: string, args?: Record<string, unknown>) {
      const call: Call = { kind: 'rpc', name, ops: [{ method: 'args', args: [args ?? {}] }] };
      calls.push(call);
      return builder(call);
    },
    auth: {
      async getSession() {
        return { data: { session: state.session }, error: null };
      },
      async getUser() {
        return { data: { user: state.session?.user ?? null }, error: null };
      },
      onAuthStateChange(cb: (event: string, session: Session | null) => void) {
        authListeners.add(cb);
        return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } };
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        const expected = state.passwords?.[email];
        if (expected !== undefined && expected !== password) {
          return { data: null, error: { message: 'Invalid login credentials', status: 400 } };
        }
        return { data: { session: state.session }, error: null };
      },
      async signOut() {
        state.session = null;
        for (const cb of authListeners) cb('SIGNED_OUT', null);
        return { error: null };
      },
      async updateUser() {
        return { data: { user: state.session?.user ?? null }, error: null };
      },
    },
    storage: {
      from(bucket: string) {
        return {
          async createSignedUrls(paths: string[]) {
            return {
              data: paths.map((p) => ({
                path: p,
                signedUrl: `https://arquivos.test/${bucket}/${p}`,
              })),
              error: null,
            };
          },
          async createSignedUrl(path: string, _seconds: number, opts?: { download?: string }) {
            const download = opts?.download ? `?download=${encodeURIComponent(opts.download)}` : '';
            return {
              data: { signedUrl: `https://arquivos.test/${bucket}/${path}${download}` },
              error: null,
            };
          },
          async remove(paths: string[]) {
            return { data: paths.map((name) => ({ name })), error: null };
          },
        };
      },
    },
    functions: {
      invoke(name: string, options: { body?: unknown }) {
        return invoke.handler(name, options);
      },
    },
  };

  return {
    client,
    state,
    calls,
    /** Começa de novo com estas tabelas/RPCs/sessão. */
    reset(next: Partial<FakeState> = {}) {
      state.tables = structuredClone(next.tables ?? {});
      state.rpc = next.rpc ?? {};
      state.session = next.session ?? null;
      state.passwords = next.passwords;
      calls.length = 0;
      failures.length = 0;
      authListeners.clear();
      invoke.handler = async () => ({ data: null, error: null });
    },
    /** Próximas chamadas a esta tabela/RPC (opcionalmente só com este método) dão erro. */
    fail(kind: Call['kind'], name: string, error: unknown, method?: string) {
      failures.push({ kind, name, method, error });
    },
    onInvoke(handler: typeof invoke.handler) {
      invoke.handler = handler;
    },
    /** Chamadas feitas a uma tabela/RPC com um método (ex.: writes('songs', 'update')). */
    writes(name: string, method: string) {
      return calls
        .filter((c) => c.name === name && c.ops.some((o) => o.method === method))
        .map((c) => c.ops.find((o) => o.method === method)?.args[0]);
    },
    emitAuth(event: string, session: Session | null) {
      state.session = session;
      for (const cb of authListeners) cb(event, session);
    },
  };
}

export const fake = createFakeSupabase();
