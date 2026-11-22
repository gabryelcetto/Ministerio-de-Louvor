import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { friendlyError } from '@/lib/errors';
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
  FUNCTION_NAME_MAX,
  functionFormSchema,
  nextSortOrder,
  SECTION_OPTION,
  useAddFunction,
  useDeleteFunction,
  useManagedFunctions,
  useMoveFunction,
  useRenameFunction,
  useSetFunctionActive,
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
  const move = useMoveFunction();
  const setActive = useSetFunctionActive();
  const remove = useDeleteFunction();
  const [renaming, setRenaming] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<MinistryFunction | null>(null);
  const [deleteError, setDeleteError] = useState<{ fn: MinistryFunction; message: string } | null>(
    null,
  );

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-muted-foreground">
        Funções cadastradas ({functions.length})
      </h2>
      <FormError error={setSection.error ?? move.error ?? setActive.error} />
      {deleteError && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border bg-card p-3 text-sm">
          <p>{deleteError.message}</p>
          {deleteError.fn.active && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() =>
                setActive.mutate(
                  { id: deleteError.fn.id, active: false },
                  { onSuccess: () => setDeleteError(null) },
                )
              }
            >
              Desativar {deleteError.fn.name}
            </Button>
          )}
        </div>
      )}
      <ol aria-label="Funções do ministério" className="flex flex-col gap-2">
        {functions.map((fn, index) => (
          <li
            key={fn.id}
            className={cn(
              'flex flex-col gap-2 rounded-xl border p-3',
              fn.active ? 'bg-card' : 'bg-muted',
            )}
          >
            {renaming === fn.id ? (
              <RenameForm fn={fn} onDone={() => setRenaming(null)} />
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 font-medium">
                  {fn.name}
                  {!fn.active && (
                    <span className="ml-2 rounded-md bg-chip px-2 py-0.5 text-xs font-semibold">
                      Desativada
                    </span>
                  )}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === 0 || move.isPending}
                  onClick={() => move.mutate({ id: fn.id, delta: -1 })}
                  aria-label={`Subir ${fn.name}`}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === functions.length - 1 || move.isPending}
                  onClick={() => move.mutate({ id: fn.id, delta: 1 })}
                  aria-label={`Descer ${fn.name}`}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Grupo</span>
                <select
                  aria-label={`Grupo de ${fn.name}`}
                  value={fn.section}
                  disabled={setSection.isPending}
                  onChange={(e) =>
                    setSection.mutate({ id: fn.id, section: e.target.value as Section })
                  }
                  className="h-11 rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {SECTIONS.map((value) => (
                    <option key={value} value={value}>
                      {SECTION_OPTION[value].label}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRenaming(fn.id)}
                aria-label={`Renomear ${fn.name}`}
              >
                <Pencil aria-hidden="true" />
                Renomear
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={setActive.isPending}
                onClick={() => setActive.mutate({ id: fn.id, active: !fn.active })}
                aria-label={`${fn.active ? 'Desativar' : 'Reativar'} ${fn.name}`}
              >
                {fn.active ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                {fn.active ? 'Desativar' : 'Reativar'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDeleteError(null);
                  setDeleting(fn);
                }}
                aria-label={`Excluir ${fn.name}`}
              >
                <Trash2 aria-hidden="true" />
                Excluir
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Excluir a função ${deleting.name}?` : 'Excluir função?'}
        confirmLabel="Excluir"
        destructive
        busy={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const fn = deleting;
          if (!fn) return;
          remove.mutate(fn.id, {
            onError: (error) => setDeleteError({ fn, message: friendlyError(error) }),
            onSettled: () => setDeleting(null),
          });
        }}
      >
        Só dá para excluir uma função que nunca foi usada. Se já foi, desative.
      </ConfirmDialog>
    </div>
  );
}

function RenameForm({ fn, onDone }: { fn: MinistryFunction; onDone: () => void }) {
  const id = useId();
  const rename = useRenameFunction();
  const [name, setName] = useState(fn.name);
  return (
    <form
      noValidate
      aria-label={`Renomear ${fn.name}`}
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || name.trim() === fn.name) return onDone();
        rename.mutate({ id: fn.id, name }, { onSuccess: onDone });
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Label htmlFor={id}>Novo nome</Label>
        <Input
          id={id}
          value={name}
          maxLength={FUNCTION_NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>
      <Button type="button" variant="outline" onClick={onDone}>
        Cancelar
      </Button>
      <Button type="submit" disabled={rename.isPending}>
        Salvar
      </Button>
      <div className="basis-full">
        <FormError error={rename.error} />
      </div>
    </form>
  );
}
