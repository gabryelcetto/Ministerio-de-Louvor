import { MessageCircle, Pencil, Phone, UserCheck, UserX } from 'lucide-react';
import { useId, useState } from 'react';
import { useParams } from 'react-router';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormError } from '@/components/common/form-error';
import { ErrorState, LoadingState } from '@/components/common/states';
import { OverflowMenu, type OverflowMenuItem } from '@/components/layout/overflow-menu';
import { ScreenHeader } from '@/components/layout/screen-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermission, useSession } from '@/features/auth';
import { initials } from '@/features/escalas';
import { useSingleFlight } from '@/hooks/use-single-flight';
import { whatsappChatUrl } from '@/lib/share';
import { cn } from '@/lib/utils';
import {
  buildMembers,
  ROLE_LABEL,
  telHref,
  useMembers,
  useSetMemberActive,
  useSetMemberRole,
  useUpdateMember,
  type Member,
} from '../api';
import { useManagedFunctions } from '../functions';
import { SECTION_BADGE } from '../sections';

/**
 * Integrante (/integrantes/:id), para todos: nome, apelido, funções e grupo. Telefone com
 * "Ligar" e "WhatsApp" só com members.view_contacts. Quem gerencia integrantes edita os dados e
 * as funções, muda o perfil (permissions.manage) e desativa/reativa — o banco protege o dono,
 * a própria pessoa e o último administrador.
 */
export function MemberDetailPage() {
  const { memberId = '' } = useParams();
  const { members, contacts, canViewContacts } = useMembers();
  const member = members.data
    ? buildMembers(members.data, canViewContacts ? (contacts.data ?? null) : null).find(
        (m) => m.id === memberId,
      )
    : undefined;

  if (members.isPending) {
    return (
      <>
        <ScreenHeader title="Integrante" back="/integrantes" />
        <LoadingState label="Carregando integrante…" />
      </>
    );
  }
  if (members.isError) {
    return (
      <>
        <ScreenHeader title="Integrante" back="/integrantes" />
        <ErrorState onRetry={() => void members.refetch()} />
      </>
    );
  }
  if (!member) {
    return (
      <>
        <ScreenHeader title="Integrante" back="/integrantes" />
        <p className="mx-auto max-w-[45rem] rounded-2xl border bg-card p-4 text-sm">
          Integrante não encontrado.
        </p>
      </>
    );
  }
  return <MemberView member={member} canViewContacts={canViewContacts} />;
}

function MemberView({ member, canViewContacts }: { member: Member; canViewContacts: boolean }) {
  const { session } = useSession();
  const canManage = usePermission('members.manage');
  const canPermissions = usePermission('permissions.manage');
  const [editing, setEditing] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);
  const status = useSetMemberActive(member.id);
  const self = member.id === session?.user.id;
  // A interface só esconde: as regras de verdade estão no trigger do banco.
  const canChangeStatus = canManage && !self && !member.isOwner;
  const role = ROLE_LABEL[member.role];
  const tel = member.phone ? telHref(member.phone) : null;
  const whatsapp = member.phone ? whatsappChatUrl(member.phone) : null;

  const menu: OverflowMenuItem[] = [
    ...(canManage ? [{ label: 'Editar', icon: Pencil, onSelect: () => setEditing(true) }] : []),
    ...(canChangeStatus
      ? [
          member.active
            ? {
                label: 'Desativar',
                icon: UserX,
                destructive: true,
                onSelect: () => setConfirmStatus(true),
              }
            : { label: 'Reativar', icon: UserCheck, onSelect: () => setConfirmStatus(true) },
        ]
      : []),
  ];

  return (
    <>
      <ScreenHeader
        title={member.name}
        subtitle={member.active ? undefined : 'Inativo'}
        back="/integrantes"
        actions={menu.length > 0 ? <OverflowMenu items={menu} /> : undefined}
      />
      <section className="mx-auto flex max-w-[45rem] flex-col gap-4">
        <div className="flex items-center gap-4 rounded-2xl border bg-card p-4">
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-lg font-bold text-brand-text"
          >
            {initials(member.name)}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-card-title">{member.fullName || member.name}</span>
            {member.name !== member.fullName && (
              <span className="text-sm text-muted-foreground">Apelido: {member.name}</span>
            )}
            <span className="flex flex-wrap gap-1.5">
              {role && (
                <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                  {role}
                </span>
              )}
              {member.sections.map((s) => (
                <span key={s} className="rounded-md border px-2 py-0.5 text-xs font-medium">
                  {SECTION_BADGE[s]}
                </span>
              ))}
              {!member.active && (
                <span className="rounded-md bg-chip px-2 py-0.5 text-xs font-semibold">
                  Inativo
                </span>
              )}
            </span>
          </div>
        </div>

        <section
          aria-labelledby="funcoes"
          className="flex flex-col gap-2 rounded-2xl border bg-card p-4"
        >
          <h2 id="funcoes" className="section-label">
            Funções
          </h2>
          {member.functions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem função definida.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {member.functions.map((fn) => (
                <li key={fn} className="rounded-md bg-chip px-2 py-1 text-sm font-medium">
                  {fn}
                </li>
              ))}
            </ul>
          )}
        </section>

        {canViewContacts && (
          <section
            aria-labelledby="contato"
            className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
          >
            <h2 id="contato" className="section-label">
              Contato
            </h2>
            {member.phone ? (
              <>
                <p className="inline-flex items-center gap-2 font-medium">
                  <Phone aria-hidden="true" className="size-4" />
                  {member.phone}
                </p>
                <div className="flex flex-wrap gap-2">
                  {tel && (
                    <Button asChild variant="outline">
                      <a href={tel}>
                        <Phone aria-hidden="true" />
                        Ligar
                      </a>
                    </Button>
                  )}
                  {whatsapp && (
                    <Button asChild variant="outline">
                      <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                        <MessageCircle aria-hidden="true" />
                        WhatsApp
                        <span className="sr-only"> (abre em nova aba)</span>
                      </a>
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Sem telefone cadastrado.</p>
            )}
          </section>
        )}

        {editing && (
          <EditMember
            member={member}
            canViewContacts={canViewContacts}
            onDone={() => setEditing(false)}
          />
        )}

        {canPermissions && !self && !member.isOwner && <RoleForm member={member} />}

        <FormError error={status.error} fallback="Não foi possível mudar a situação." />
      </section>

      <ConfirmDialog
        open={confirmStatus}
        title={member.active ? `Desativar ${member.name}?` : `Reativar ${member.name}?`}
        confirmLabel={member.active ? 'Desativar' : 'Reativar'}
        destructive={member.active}
        busy={status.isPending}
        onCancel={() => setConfirmStatus(false)}
        onConfirm={() =>
          status.mutate(!member.active, { onSettled: () => setConfirmStatus(false) })
        }
      >
        {member.active
          ? 'A pessoa não consegue mais entrar, mas o histórico fica.'
          : 'A pessoa volta a entrar no app com a mesma senha.'}
      </ConfirmDialog>
    </>
  );
}

function EditMember({
  member,
  canViewContacts,
  onDone,
}: {
  member: Member;
  canViewContacts: boolean;
  onDone: () => void;
}) {
  const id = useId();
  const functions = useManagedFunctions();
  const save = useUpdateMember(member.id);
  const once = useSingleFlight();
  const [fullName, setFullName] = useState(member.fullName);
  const [displayName, setDisplayName] = useState(
    member.name !== member.fullName ? member.name : '',
  );
  const [phone, setPhone] = useState(member.phone ?? '');
  const [selected, setSelected] = useState<number[] | null>(null);
  const initialIds = (functions.data ?? [])
    .filter((f) => member.functions.includes(f.name))
    .map((f) => f.id);
  const ids = selected ?? initialIds;
  const nameProblem = fullName.trim().length < 2 ? 'Informe o nome completo.' : null;
  const [tried, setTried] = useState(false);

  return (
    <form
      noValidate
      aria-label={`Editar ${member.name}`}
      className="flex flex-col gap-4 rounded-2xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (nameProblem) return;
        void once(async () => {
          await save.mutateAsync({
            fullName,
            displayName,
            // Quem não vê telefones não mexe no telefone (null = manter).
            phone: canViewContacts ? phone : (null as unknown as string),
            functionIds: ids,
          });
          onDone();
        }).catch(() => undefined);
      }}
    >
      <h2 className="section-label">Editar dados</h2>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-nome`}>Nome completo</Label>
        <Input id={`${id}-nome`} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        {tried && nameProblem && <p className="text-sm text-destructive">{nameProblem}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-apelido`}>Como aparece no app (opcional)</Label>
        <Input
          id={`${id}-apelido`}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      {canViewContacts && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-tel`}>Telefone (opcional)</Label>
          <Input
            id={`${id}-tel`}
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Funções</legend>
        <div className="flex flex-wrap gap-2">
          {(functions.data ?? [])
            // Desativadas só aparecem se a pessoa já tem (para poder tirar).
            .filter((f) => f.active || ids.includes(f.id))
            .map((f) => {
              const checked = ids.includes(f.id);
              return (
                <label
                  key={f.id}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm',
                    checked && 'border-brand bg-brand-soft font-semibold text-brand-text',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelected(checked ? ids.filter((x) => x !== f.id) : [...ids, f.id])
                    }
                    className="size-4 accent-[var(--primary)]"
                  />
                  {f.name}
                </label>
              );
            })}
        </div>
      </fieldset>
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

function RoleForm({ member }: { member: Member }) {
  const name = useId();
  const setRole = useSetMemberRole(member.id);
  const current = member.role === 'admin' ? 'admin' : 'member';
  return (
    <fieldset className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
      <legend className="section-label px-1">Perfil de acesso</legend>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ['member', 'Integrante'],
            ['admin', 'Administração'],
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-semibold',
              current === value && 'border-brand bg-brand-soft text-brand-text',
            )}
          >
            <input
              type="radio"
              name={name}
              checked={current === value}
              disabled={setRole.isPending}
              onChange={() => setRole.mutate(value)}
              className="size-4 accent-[var(--primary)]"
            />
            {label}
          </label>
        ))}
      </div>
      <p className="text-caption text-muted-foreground">
        Administração vê e gerencia tudo. A mudança vale na hora.
      </p>
      <FormError error={setRole.error} fallback="Não foi possível mudar o perfil." />
    </fieldset>
  );
}
