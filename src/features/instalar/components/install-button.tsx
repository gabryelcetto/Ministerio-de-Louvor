import { CheckCircle2, Download } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useInstallState } from '@/hooks/use-install-state';
import { promptInstall } from '@/lib/install';

/**
 * "Instalar app": abre a janela do navegador quando ele oferece (Android/Chrome); senão, leva
 * ao passo a passo (/instalar), que cobre o iPhone. Já instalado: só informa.
 */
export function InstallButton({
  variant = 'default',
  size,
  className,
}: Pick<ButtonProps, 'variant' | 'size' | 'className'>) {
  const install = useInstallState();
  const [busy, setBusy] = useState(false);

  if (install.installed) {
    return (
      <p className="inline-flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 aria-hidden="true" className="size-4 text-primary" />
        App instalado neste aparelho.
      </p>
    );
  }

  if (install.canPrompt) {
    return (
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void promptInstall().finally(() => setBusy(false));
        }}
      >
        <Download aria-hidden="true" />
        Instalar app
      </Button>
    );
  }

  return (
    <Button asChild variant={variant} size={size} className={className}>
      <Link to="/instalar">
        <Download aria-hidden="true" />
        Instalar app
      </Link>
    </Button>
  );
}
