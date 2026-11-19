import { AlertCircle, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/** Carregando (anunciado a leitores de tela). */
export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-8 text-muted-foreground">
      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      {label}
    </div>
  );
}

/** Erro de consulta com botão "Tentar de novo". */
export function ErrorState({
  message = 'Não foi possível carregar os dados.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl border border-destructive/40 p-4"
    >
      <p className="flex items-center gap-2 text-sm">
        <AlertCircle aria-hidden="true" className="size-4 text-destructive" />
        {message}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  );
}

/** Lista vazia. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
