import { WifiOff } from 'lucide-react';
import { useOnline } from '@/hooks/use-online';

/** Faixa do modo offline: mostra o que foi salvo e explica o que fica desativado. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-start gap-2 border-b bg-chip px-4 py-2 text-sm text-foreground md:px-8"
    >
      <WifiOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>
        <strong>Sem internet: mostrando o que foi salvo neste aparelho.</strong>{' '}
        <span className="text-muted-foreground">
          Editar e enviar arquivos voltam quando a conexão voltar.
        </span>
      </p>
    </div>
  );
}
