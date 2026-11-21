import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { FormError } from '@/components/common/form-error';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermission } from '@/features/auth';
import { cn } from '@/lib/utils';
import {
  functionFormSchema,
  nextSortOrder,
  SECTION_OPTION,
  useAddFunction,
  useManagedFunctions,
  useSetFunctionSection,
  type FunctionFormValues,
  type MinistryFunction,
} from '../functions';
import type { Section } from '../sections';
import { ScreenHeader } from '@/components/layout/screen-header';

const SECTIONS: Section[] = ['vocal', 'instrumental'];

/**
 * Funções do ministério e o grupo de cada uma (Cantores ou Instrumentistas). O grupo só define
 * selos e filtros — não dá permissão. Só com members.manage (o RLS confere).
 */
export function FunctionsPage() {
  const canManage = usePermission('members.manage');
  const functions = useManagedFunctions();

  return (
    <>
      <ScreenHeader title="Funções do ministério" back="/integrantes" />
      <section className="mx-auto flex max-w-2xl flex-col gap-5">
        <header>
          <p className="text-sm text-muted-foreground">
            Cada função pertence a um grupo: Cantores ou Instrumentistas. O grupo aparece como selo
            e filtro nas escalas e na lista de integrantes.
          </p>
        </header>

        {!canManage ? (
          <p role="alert" className="rounded-lg border p-4">
            Você não tem permissão para gerenciar as funções do ministério.
          </p>
        ) : functions.isPending ? (
          <LoadingState label="Carregando funções…" />
        ) : functions.isError ? (
          <ErrorState onRetry={() => void functions.refetch()} />
        ) : (
          <>
            <AddFunctionForm sortOrder={nextSortOrder(functions.data)} />
            {functions.data.length === 0 ? (
              <EmptyState>Nenhuma função cadastrada.</EmptyState>
            ) : (
              <FunctionList functions={functions.data} />
            )}
          </>
        )}
      </section>
    </>
  );
}

function AddFunctionForm({ sortOrder }: { sortOrder: number }) {
  const id = useId();
  const add = useAddFunction();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FunctionFormValues>({
    resolver: zodResolver(functionFormSchema),
    // Sem grupo marcado de propósito: quem cadastra precisa escolher (pendência 34).
    defaultValues: { name: '', section: undefined },
  });
  const section = useWatch({ control, name: 'section' });
  const nameError = errors.name?.message;
  const sectionError = errors.section?.message;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Nova função</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((values) =>
            add.mutate({ ...values, sortOrder }, { onSuccess: () => reset() }),
          )}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-nome`}>Nome da função</Label>
            <Input
              id={`${id}-nome`}
              autoComplete="off"
              placeholder="Ex.: Ministro(a)"
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? `${id}-nome-erro` : undefined}
              className="h-11 text-base"
              {...register('name')}
            />
            {nameError && (
              <p id={`${id}-nome-erro`} className="text-sm text-destructive">
                {nameError}
              </p>
            )}
          </div>

          <fieldset
            className="flex flex-col gap-2"
            aria-describedby={sectionError ? `${id}-grupo-erro` : undefined}
          >
            <legend className="mb-1 text-sm font-medium">Grupo</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SECTIONS.map((value) => (
                <label
                  key={value}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm',
                    section === value && 'border-primary bg-secondary',
                  )}
                >
                  <input
                    type="radio"
                    value={value}
                    className="mt-0.5 size-4 accent-[var(--primary)]"
                    {...register('section')}
                  />
                  <span className="flex flex-col">
                    <span className="font-medium">{SECTION_OPTION[value].label}</span>
                    <span className="text-muted-foreground">{SECTION_OPTION[value].hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {sectionError && (
              <p id={`${id}-grupo-erro`} className="text-sm text-destructive">
                {sectionError}
              </p>
            )}
          </fieldset>

          <FormError error={add.error} />
          <Button type="submit" className="self-start" disabled={add.isPending}>
            <Plus aria-hidden="true" />
            {add.isPending ? 'Adicionando…' : 'Adicionar função'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function FunctionList({ functions }: { functions: MinistryFunction[] }) {
  const setSection = useSetFunctionSection();

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-muted-foreground">
        Funções cadastradas ({functions.length})
      </h2>
      <FormError error={setSection.error} />
      <ul className="flex flex-col gap-2">
        {functions.map((fn) => (
          <li
            key={fn.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3"
          >
            <span className="font-medium">{fn.name}</span>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Grupo</span>
              <select
                aria-label={`Grupo de ${fn.name}`}
                value={fn.section}
                disabled={setSection.isPending}
                onChange={(e) =>
                  setSection.mutate({ id: fn.id, section: e.target.value as Section })
                }
                className="h-10 rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {SECTIONS.map((value) => (
                  <option key={value} value={value}>
                    {SECTION_OPTION[value].label}
                  </option>
                ))}
              </select>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
