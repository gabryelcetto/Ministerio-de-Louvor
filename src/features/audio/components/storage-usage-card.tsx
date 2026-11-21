import { HardDrive, TriangleAlert } from 'lucide-react';
import { ErrorState, LoadingState } from '@/components/common/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBytes } from '@/lib/audio/limits';
import { usePermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { storageLevel, useStorageUsage } from '../api';

/** Espaço usado pelos áudios no plano grátis (1 GB). Só para quem tem media.manage (admin). */
export function StorageUsageCard() {
  const allowed = usePermission('media.manage');
  const usage = useStorageUsage(allowed);
  if (!allowed) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive aria-hidden="true" className="size-5" />
          Espaço dos áudios
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {usage.isPending ? (
          <LoadingState label="Calculando…" />
        ) : usage.isError ? (
          <ErrorState onRetry={() => void usage.refetch()} />
        ) : (
          (() => {
            const { totalBytes, limitBytes, rehearsalBytes, referenceBytes, files } = usage.data;
            const fraction = Math.min(1, totalBytes / limitBytes);
            const level = storageLevel(usage.data);
            return (
              <>
                {level === 'blocked' && (
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-destructive/40 p-3 text-sm"
                  >
                    <TriangleAlert
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-destructive"
                    />
                    <span>
                      Passou de 90% do espaço: <strong>novos áudios estão bloqueados</strong>{' '}
                      (gravações de ensaio e referências). Apague áudios antigos para liberar.
                    </span>
                  </p>
                )}
                {level === 'warn' && (
                  <p role="status" className="text-sm font-medium">
                    O espaço está acabando. Ao passar de 90%, o app para de aceitar áudios novos.
                  </p>
                )}
                <p className="text-sm">
                  <strong>{formatBytes(totalBytes)}</strong> de {formatBytes(limitBytes)} usados (
                  {Math.round(fraction * 100)}%)
                </p>
                <div
                  role="progressbar"
                  aria-label="Espaço usado"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(fraction * 100)}
                  className="h-3 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className={cn(
                      'h-full rounded-full',
                      level === 'blocked'
                        ? 'bg-destructive'
                        : level === 'warn'
                          ? 'bg-accent'
                          : 'bg-primary',
                    )}
                    style={{ width: `${Math.max(fraction * 100, 1)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {files} arquivo(s) · ensaios {formatBytes(rehearsalBytes)} · referências{' '}
                  {formatBytes(referenceBytes)}. Gravações de ensaio são apagadas depois de 90 dias;
                  áudios de referência ficam.
                </p>
              </>
            );
          })()
        )}
      </CardContent>
    </Card>
  );
}
