import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { FormError } from '@/components/common/form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { newPasswordSchema, PASSWORD_HINT, passwordProblems } from '@/lib/password';
import { changePassword } from '../api';

const withCurrentSchema = z
  .object({ current: z.string().min(1, 'Informe a senha atual.') })
  .and(newPasswordSchema);

type Values = { current?: string; password: string; confirm: string };

/**
 * Nova senha + confirmação. `askCurrent` pede a senha atual (Configurações); no primeiro
 * acesso não pede, porque a pessoa acabou de entrar com a provisória.
 */
export function PasswordForm({
  askCurrent,
  submitLabel,
  onDone,
}: {
  askCurrent: boolean;
  submitLabel: string;
  onDone?: () => void;
}) {
  const id = useId();
  const client = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<Values>({
    // Os dois schemas produzem o mesmo formato (current é opcional quando não é pedida).
    resolver: (askCurrent
      ? zodResolver(withCurrentSchema)
      : zodResolver(newPasswordSchema)) as Resolver<Values>,
    defaultValues: { current: '', password: '', confirm: '' },
  });

  const save = useMutation({
    mutationFn: (v: Values) => changePassword(v.password, askCurrent ? v.current : undefined),
    onSuccess: async () => {
      reset();
      await client.invalidateQueries({ queryKey: ['me'] });
      onDone?.();
    },
  });

  const password = useWatch({ control, name: 'password' });
  const pending = password ? passwordProblems(password) : [];

  const field = (name: keyof Values, label: string, autoComplete: string, hint?: string) => {
    const error = errors[name]?.message;
    const describedBy = [hint ? `${id}-${name}-dica` : null, error ? `${id}-${name}-erro` : null]
      .filter(Boolean)
      .join(' ');
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-${name}`}>{label}</Label>
        {hint && (
          <p id={`${id}-${name}-dica`} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )}
        <Input
          id={`${id}-${name}`}
          type="password"
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          className="h-11 text-base"
          {...register(name)}
        />
        {error && (
          <p id={`${id}-${name}-erro`} className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="flex flex-col gap-4">
      {askCurrent && field('current', 'Senha atual', 'current-password')}
      {field('password', 'Nova senha', 'new-password', PASSWORD_HINT)}
      {password && pending.length > 0 && !errors.password && (
        <ul className="-mt-2 list-disc pl-5 text-sm text-muted-foreground" aria-live="polite">
          {pending.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {field('confirm', 'Repita a nova senha', 'new-password')}
      <FormError error={save.error} />
      {save.isSuccess && (
        <p role="status" className="text-sm font-medium">
          Senha alterada.
        </p>
      )}
      <Button type="submit" size="lg" disabled={save.isPending} className="self-start">
        {save.isPending ? 'Salvando…' : submitLabel}
      </Button>
    </form>
  );
}
