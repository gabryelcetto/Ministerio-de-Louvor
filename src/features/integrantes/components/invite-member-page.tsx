import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Check, Copy, MessageCircle, TriangleAlert, UserPlus } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { FormError } from '@/components/common/form-error';
import { ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMyPermissions } from '@/features/auth/hooks/use-me';
import { cn } from '@/lib/utils';
import {
  buildInviteMessage,
  inviteFormSchema,
  ROLE_OPTIONS,
  useInviteMember,
  useMinistryFunctions,
  whatsappLink,
  type InviteFormValues,
  type InviteResult,
} from '../invite';

/** Cadastrar integrante (só com members.manage; líder/admin só com permissions.manage). */
export function InviteMemberPage() {
  const permissions = useMyPermissions();
  const [result, setResult] = useState<InviteResult | null>(null);

  if (permissions.isPending) return <LoadingState label="Carregando…" />;
  if (permissions.isError) return <ErrorState onRetry={() => void permissions.refetch()} />;

  const canManage = permissions.data.includes('members.manage');
  const canSetRoles = permissions.data.includes('permissions.manage');

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link
        to="/integrantes"
        className="inline-flex items-center gap-2 self-start rounded-md px-2 py-1 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Integrantes
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Cadastrar integrante</h1>
        <p className="text-sm text-muted-foreground">
          A pessoa recebe uma senha provisória e cria a própria senha no primeiro acesso.
        </p>
      </header>

      {!canManage ? (
        <p role="alert" className="rounded-lg border p-4">
          Você não tem permissão para cadastrar integrantes.
        </p>
      ) : result ? (
        <InviteResultCard result={result} onAnother={() => setResult(null)} />
      ) : (
        <InviteForm canSetRoles={canSetRoles} onDone={setResult} />
      )}
    </section>
  );
}

function InviteForm({
  canSetRoles,
  onDone,
}: {
  canSetRoles: boolean;
  onDone: (result: InviteResult) => void;
}) {
  const id = useId();
  const functions = useMinistryFunctions();
  const invite = useInviteMember();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      fullName: '',
      displayName: '',
      email: '',
      accessRole: 'member',
      functionIds: [],
    },
  });
  const selected = useWatch({ control, name: 'functionIds' });
  const role = useWatch({ control, name: 'accessRole' });

  const toggleFunction = (fnId: number) =>
    setValue(
      'functionIds',
      selected.includes(fnId) ? selected.filter((x) => x !== fnId) : [...selected, fnId],
    );

  const text = (
    name: 'fullName' | 'displayName' | 'email',
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement>,
  ) => {
    const error = errors[name]?.message;
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-${name}`}>{label}</Label>
        <Input
          id={`${id}-${name}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-${name}-erro` : undefined}
          className="h-11 text-base"
          {...props}
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
    <Card>
      <CardContent className="pt-5">
        <form
          noValidate
          onSubmit={handleSubmit((values) => invite.mutate(values, { onSuccess: onDone }))}
          className="flex flex-col gap-5"
        >
          {text('fullName', 'Nome completo', { autoComplete: 'off' })}
          {text('displayName', 'Como aparece no app (opcional)', {
            autoComplete: 'off',
            placeholder: 'Ex.: Maria',
          })}
          {text('email', 'E-mail', { type: 'email', inputMode: 'email', autoComplete: 'off' })}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Funções no ministério</legend>
            {functions.isPending ? (
              <LoadingState label="Carregando funções…" />
            ) : functions.isError ? (
              <ErrorState onRetry={() => void functions.refetch()} />
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {functions.data.map((fn) => (
                  <label
                    key={fn.id}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm',
                      selected.includes(fn.id) && 'border-primary bg-secondary',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(fn.id)}
                      onChange={() => toggleFunction(fn.id)}
                      className="size-4 accent-[var(--primary)]"
                    />
                    {fn.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Perfil de acesso</legend>
            {ROLE_OPTIONS.map((option) => {
              const disabled = option.value !== 'member' && !canSetRoles;
              return (
                <label
                  key={option.value}
                  className={cn(
                    'flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm',
                    role === option.value && 'border-primary bg-secondary',
                    disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                  )}
                >
                  <input
                    type="radio"
                    value={option.value}
                    disabled={disabled}
                    className="mt-0.5 size-4 accent-[var(--primary)]"
                    {...register('accessRole')}
                  />
                  <span className="flex flex-col">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-muted-foreground">{option.hint}</span>
                  </span>
                </label>
              );
            })}
            {!canSetRoles && (
              <p className="text-sm text-muted-foreground">
                Liderança e Administração só podem ser definidas por quem gerencia permissões.
              </p>
            )}
          </fieldset>

          <FormError error={invite.error} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="lg" disabled={invite.isPending}>
              <UserPlus aria-hidden="true" />
              {invite.isPending ? 'Cadastrando…' : 'Cadastrar'}
            </Button>
            <Button type="button" variant="outline" size="lg" asChild>
              <Link to="/integrantes">Cancelar</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2500);
    } catch {
      setCopied(null);
    }
  };
  return { copied, copy };
}

function InviteResultCard({ result, onAnother }: { result: InviteResult; onAnother: () => void }) {
  const { copied, copy } = useCopy();
  const message = buildInviteMessage({ ...result, appUrl: window.location.origin });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Check aria-hidden="true" className="size-5 text-primary" />
          {result.fullName} foi cadastrado(a)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-accent bg-accent/15 p-3 text-sm"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {/* Um único span: dentro do flex, texto e <strong> soltos viravam colunas separadas. */}
          <span>
            Anote ou envie agora: esta senha provisória <strong>não será mostrada de novo</strong>.
          </span>
        </p>

        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[9rem_1fr]">
          <dt className="text-muted-foreground">E-mail</dt>
          <dd className="font-medium break-all">{result.email}</dd>
          <dt className="text-muted-foreground">Senha provisória</dt>
          <dd>
            <code
              aria-label="Senha provisória"
              className="rounded-md bg-muted px-2 py-1 font-mono text-lg font-semibold tracking-wide select-all"
            >
              {result.temporaryPassword}
            </code>
          </dd>
        </dl>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void copy('senha', result.temporaryPassword)}
          >
            <Copy aria-hidden="true" />
            Copiar senha
          </Button>
          <Button type="button" variant="outline" onClick={() => void copy('mensagem', message)}>
            <Copy aria-hidden="true" />
            Copiar mensagem
          </Button>
          <Button type="button" variant="accent" asChild>
            <a href={whatsappLink(message)} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden="true" />
              Enviar pelo WhatsApp
              <span className="sr-only">(abre em nova aba)</span>
            </a>
          </Button>
        </div>
        <p role="status" aria-live="polite" className="min-h-5 text-sm font-medium">
          {copied === 'senha' && 'Senha copiada.'}
          {copied === 'mensagem' && 'Mensagem copiada.'}
        </p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mensagem-whatsapp">Mensagem pronta para o WhatsApp</Label>
          <Textarea
            id="mensagem-whatsapp"
            readOnly
            value={message}
            rows={8}
            className="font-sans text-sm"
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onAnother}>
            <UserPlus aria-hidden="true" />
            Cadastrar outra pessoa
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/integrantes">Voltar para Integrantes</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
