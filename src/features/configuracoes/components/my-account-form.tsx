import { useId, useState } from 'react';
import { FormError } from '@/components/common/form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateMyAccount } from '@/features/integrantes';
import { useSingleFlight } from '@/hooks/use-single-flight';

/**
 * Minha conta: a pessoa edita o próprio nome, apelido e telefone. Perfil de acesso, dono e
 * situação o banco não deixa mudar daqui (nem pela API direta).
 */
export function MyAccountForm({
  initial,
  onDone,
}: {
  initial: { fullName: string; displayName: string; phone: string };
  onDone: () => void;
}) {
  const id = useId();
  const save = useUpdateMyAccount();
  const once = useSingleFlight();
  const [fullName, setFullName] = useState(initial.fullName);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [phone, setPhone] = useState(initial.phone);
  const [tried, setTried] = useState(false);
  const problem = fullName.trim().length < 2 ? 'Informe o nome completo.' : null;

  return (
    <form
      noValidate
      aria-label="Editar meus dados"
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (problem) return;
        void once(async () => {
          await save.mutateAsync({ fullName, displayName, phone });
          onDone();
        }).catch(() => undefined);
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-nome`}>Nome completo</Label>
        <Input id={`${id}-nome`} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        {tried && problem && <p className="text-sm text-destructive">{problem}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-apelido`}>Como aparece no app (opcional)</Label>
        <Input
          id={`${id}-apelido`}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-tel`}>Telefone (opcional)</Label>
        <Input
          id={`${id}-tel`}
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <p className="text-caption text-muted-foreground">
          Só a liderança (quem pode ver contatos) vê o seu telefone.
        </p>
      </div>
      <FormError error={save.error} fallback="Não foi possível salvar." />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
