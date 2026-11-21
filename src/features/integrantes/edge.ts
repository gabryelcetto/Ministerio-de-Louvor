import { FunctionsHttpError } from '@supabase/supabase-js';
import { UserFacingError } from '@/lib/errors';
import { supabase } from '@/services/supabase';

/** Erro de uma Edge Function já em português (o corpo é `{ error: "..." }`). */
export class EdgeFunctionError extends UserFacingError {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'EdgeFunctionError';
  }
}

/**
 * Chama uma Edge Function com o JWT da sessão. Erro HTTP vira EdgeFunctionError com a mensagem
 * do servidor (ou `fallback`); erro de rede segue para o friendlyError traduzir.
 */
export async function invokeEdgeFunction<T>(
  name: string,
  body: unknown,
  fallback: string,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body: body as object });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response;
      let message = fallback;
      try {
        const payload = (await response.json()) as { error?: unknown };
        if (typeof payload.error === 'string' && payload.error) message = payload.error;
      } catch {
        // corpo não é JSON: fica a mensagem genérica
      }
      throw new EdgeFunctionError(message, response.status);
    }
    throw error;
  }
  if (data === null) throw new Error('Resposta inesperada do servidor.');
  return data;
}
