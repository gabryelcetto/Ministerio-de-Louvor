import { AlertCircle } from 'lucide-react';
import { friendlyError } from '@/lib/errors';

/** Erro de uma ação (salvar, restaurar…), já traduzido por friendlyError. */
export function FormError({ error, fallback }: { error: unknown; fallback?: string }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/40 p-3 text-sm"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
      {friendlyError(error, fallback)}
    </p>
  );
}
