import { useEffect, useId, useRef, useState } from 'react';
import { ThemeOptions } from '@/components/theme/theme-options';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePref } from '@/lib/theme';

/**
 * Primeiro acesso neste aparelho (nenhum tema salvo): pergunta como a pessoa prefere ver o app.
 * No celular é uma folha que sobe de baixo; no computador, um diálogo no centro.
 * Escolher mostra a prévia na hora; "Continuar" salva. Fechar sem escolher salva "Automático"
 * e o modal não volta. Depois, a troca fica em Mais → Configurações → Aparência.
 */
export function ThemeChoiceDialog() {
  const { chosen, setPref, preview } = useTheme();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [value, setValue] = useState<ThemePref>('system');

  useEffect(() => {
    const dialog = ref.current;
    if (!chosen && dialog && !dialog.open) dialog.showModal();
  }, [chosen]);

  if (chosen) return null;

  const choose = (pref: ThemePref) => {
    setValue(pref);
    preview(pref);
  };
  const close = (pref: ThemePref) => {
    ref.current?.close();
    setPref(pref);
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        close('system');
      }}
      onClick={(e) => e.target === e.currentTarget && close('system')}
      className="fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none rounded-t-2xl border bg-card p-0 text-card-foreground backdrop:bg-overlay sm:inset-0 sm:m-auto sm:h-fit sm:max-w-md sm:rounded-2xl"
    >
      <div className="flex flex-col gap-5 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <span aria-hidden="true" className="mx-auto h-1.5 w-10 rounded-full bg-line sm:hidden" />
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="text-screen-title">
            Como você prefere ver o app?
          </h2>
          <p className="text-sm text-muted-foreground">
            Dá para trocar depois em Mais → Configurações → Aparência.
          </p>
        </div>
        <ThemeOptions value={value} onChange={choose} name="tema-primeiro-acesso" large />
        <Button type="button" size="lg" onClick={() => close(value)}>
          Continuar
        </Button>
      </div>
    </dialog>
  );
}
