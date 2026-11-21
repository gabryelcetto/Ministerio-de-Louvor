import { ArrowLeft, EllipsisVertical, Share, SquarePlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { useInstallState } from '@/hooks/use-install-state';
import { InstallButton } from './install-button';

/** Como instalar o app: botão no Android/Chrome; passo a passo no iPhone (Safari). */
export function InstallPage() {
  const install = useInstallState();

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link to="/configuracoes">
          <ArrowLeft aria-hidden="true" />
          Configurações
        </Link>
      </Button>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Instalar o app</h1>
        <p className="text-sm text-muted-foreground">
          Instalado, o app abre pelo ícone na tela inicial, em tela cheia, como um aplicativo.
        </p>
      </header>

      {install.installed ? (
        <InstallButton />
      ) : install.platform === 'ios' ? (
        <IosSteps />
      ) : install.canPrompt ? (
        <div className="flex flex-col gap-3">
          <p>Toque no botão e confirme na janela que o navegador abrir.</p>
          <InstallButton size="lg" className="self-start" />
        </div>
      ) : (
        <OtherBrowserSteps android={install.platform === 'android'} />
      )}
    </section>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
      >
        {n}
      </span>
      <span className="pt-1">{children}</span>
    </li>
  );
}

function Key({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <strong className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-semibold whitespace-nowrap">
      {icon}
      {children}
    </strong>
  );
}

function IosSteps() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">No iPhone ou iPad, pelo Safari:</p>
      <ol className="flex flex-col gap-4 text-base">
        <Step n={1}>
          Toque em <Key icon={<Share aria-hidden="true" className="size-4" />}>Compartilhar</Key>{' '}
          (na barra de baixo ou de cima do Safari).
        </Step>
        <Step n={2}>
          Role a lista e toque em{' '}
          <Key icon={<SquarePlus aria-hidden="true" className="size-4" />}>
            Adicionar à Tela de Início
          </Key>
          .
        </Step>
        <Step n={3}>
          Confirme em <Key icon={null}>Adicionar</Key>. O ícone do Louvor aparece na tela inicial.
        </Step>
      </ol>
      <p className="text-sm text-muted-foreground">
        Não achou a opção? Abra este endereço no <strong>Safari</strong> (em outros navegadores do
        iPhone ela pode não aparecer).
      </p>
    </div>
  );
}

function OtherBrowserSteps({ android }: { android: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-4 text-base">
        <Step n={1}>
          Abra o menu do navegador{' '}
          <Key icon={<EllipsisVertical aria-hidden="true" className="size-4" />}>Menu</Key>.
        </Step>
        <Step n={2}>
          Toque em <Key icon={null}>Instalar app</Key> ou{' '}
          <Key icon={null}>Adicionar à tela inicial</Key>.
        </Step>
      </ol>
      <p className="text-sm text-muted-foreground">
        {android
          ? 'Se a opção não aparecer, abra o app no Google Chrome.'
          : 'No computador, Chrome e Edge mostram um ícone de instalar na barra de endereço. O Firefox não instala apps.'}
      </p>
    </div>
  );
}
