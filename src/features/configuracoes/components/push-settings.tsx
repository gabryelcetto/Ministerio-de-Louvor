import { BellRing } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FormError } from '@/components/common/form-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSingleFlight } from '@/hooks/use-single-flight';
import { currentPushAvailability, disablePush, enablePush, getPushSubscription } from '../push-api';

/**
 * Configurações → "Receber avisos no celular" (Web Push). Sem a chave VAPID no build, não
 * aparece. No iPhone, só funciona com o app instalado na tela inicial (iOS 16.4 ou mais novo).
 */
export function PushSettings() {
  const [availability] = useState(currentPushAvailability);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const run = useSingleFlight();

  useEffect(() => {
    if (availability !== 'available') return;
    let alive = true;
    getPushSubscription()
      .then((sub) => alive && setEnabled(sub !== null))
      .catch(() => alive && setEnabled(false));
    return () => {
      alive = false;
    };
  }, [availability]);

  if (availability === 'hidden') return null;

  const toggle = () =>
    run(async () => {
      setBusy(true);
      setError(null);
      try {
        if (enabled) {
          await disablePush();
          setEnabled(false);
        } else {
          await enablePush();
          setEnabled(true);
        }
      } catch (e) {
        setError(e);
      } finally {
        setBusy(false);
      }
    });

  return (
    <Card id="avisos" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>Receber avisos no celular</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Escalas, comunicados e recusas chegam como notificação, mesmo com o app fechado.
        </p>
        {availability === 'ios-install' ? (
          <p className="rounded-lg bg-chip p-3 text-sm">
            No iPhone, os avisos só funcionam com o app instalado na tela inicial (iOS 16.4 ou mais
            novo). Toque em Compartilhar → “Adicionar à Tela de Início” e abra o app pelo ícone.
          </p>
        ) : availability === 'unsupported' ? (
          <p className="rounded-lg bg-chip p-3 text-sm">
            Este navegador não recebe avisos. Use o Chrome no Android ou instale o app.
          </p>
        ) : (
          <>
            <p role="status" className="text-sm font-semibold">
              {enabled === null
                ? 'Verificando…'
                : enabled
                  ? 'Ativado neste aparelho.'
                  : 'Desativado neste aparelho.'}
            </p>
            <Button
              type="button"
              needsNetwork
              variant={enabled ? 'outline' : 'default'}
              className="self-start"
              disabled={busy || enabled === null}
              onClick={() => void toggle()}
            >
              <BellRing aria-hidden="true" />
              {busy ? 'Aguarde…' : enabled ? 'Parar de receber' : 'Receber avisos'}
            </Button>
          </>
        )}
        <FormError error={error} fallback="Não foi possível mudar os avisos." />
      </CardContent>
    </Card>
  );
}
