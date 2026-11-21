import { Smartphone, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  dismissInstallTip,
  isInstallTipDismissed,
  promptInstall,
  shouldOfferInstall,
} from '@/lib/install';
import { useInstallState } from '@/hooks/use-install-state';

/** Aviso discreto no Início para quem ainda não instalou. Dispensado, não volta. */
export function InstallTip() {
  const install = useInstallState();
  const [dismissed, setDismissed] = useState(isInstallTipDismissed);

  if (dismissed || !shouldOfferInstall(install)) return null;

  return (
    <aside
      aria-label="Instalar o app"
      className="flex items-center gap-3 rounded-xl border border-dashed bg-card px-4 py-3 text-sm"
    >
      <Smartphone aria-hidden="true" className="size-5 shrink-0 text-primary" />
      <p className="flex-1">
        Use o Louvor como app: abre pelo ícone, em tela cheia.{' '}
        {install.canPrompt ? (
          <button
            type="button"
            onClick={() => void promptInstall()}
            className="rounded font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Instalar
          </button>
        ) : (
          <Link
            to="/instalar"
            className="rounded font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver como instalar
          </Link>
        )}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 shrink-0"
        aria-label="Dispensar aviso de instalação"
        onClick={() => {
          dismissInstallTip();
          setDismissed(true);
        }}
      >
        <X aria-hidden="true" />
      </Button>
    </aside>
  );
}
