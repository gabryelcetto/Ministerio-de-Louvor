import { HardDrive } from 'lucide-react';
import { ErrorState, LoadingState } from '@/components/common/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBytes } from '@/lib/audio/limits';
import { usePermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { useStorageUsage } from '../api';

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
            return (
              <>
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
                      fraction >= 0.9
                        ? 'bg-destructive'
                        : fraction >= 0.7
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
