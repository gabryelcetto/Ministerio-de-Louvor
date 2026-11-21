import { ListChecks, Phone, Search, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMyProfile, useSession, usePermission } from '@/features/auth';
import { buildMembers, matchesName, ROLE_LABEL, telHref, useMembers, type Member } from '../api';
import { canResetPassword, type ResetActor } from '../reset';
import { SECTION_BADGE } from '../sections';
import { ResetPasswordButton } from './reset-password-button';
import { ScreenHeader } from '@/components/layout/screen-header';

/** Integrantes: nome e funções; telefone só para quem tem members.view_contacts. */
export function MembersPage() {
  const { members, contacts, canViewContacts } = useMembers();
  const canManage = usePermission('members.manage');
  const profile = useMyProfile();
  const [text, setText] = useState('');
  const me: ResetActor | null = profile.data
    ? { id: profile.data.id, isOwner: profile.data.is_owner, canManageMembers: canManage }
    : null;

  const all = members.data
    ? buildMembers(members.data, canViewContacts ? (contacts.data ?? null) : null)
    : [];
  const filtered = all.filter((m) => matchesName(m, text));
  const active = filtered.filter((m) => m.active);
  // Inativos só aparecem para quem gerencia integrantes.
  const inactive = canManage ? filtered.filter((m) => !m.active) : [];

  return (
    <>
      <ScreenHeader title="Integrantes" back="/mais" />
      <section className="mx-auto flex max-w-[45rem] flex-col gap-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">
              Quem faz parte do ministério e em que funções.
              {canViewContacts && ' Você pode ver os telefones.'}
            </p>
          </div>
          {/* Só aparece com members.manage; quem decide de verdade é a Edge Function + o banco. */}
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/integrantes/cadastrar">
                  <UserPlus aria-hidden="true" />
                  Cadastrar integrante
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/integrantes/funcoes">
                  <ListChecks aria-hidden="true" />
                  Funções do ministério
                </Link>
              </Button>
            </div>
          )}
        </header>

        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Buscar integrante"
            placeholder="Buscar pelo nome…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-11 pl-9 text-base"
          />
        </div>

        {canViewContacts && contacts.isError && (
          <ErrorState
            message="Não foi possível carregar os telefones."
            onRetry={() => void contacts.refetch()}
          />
        )}

        {members.isPending ? (
          <LoadingState label="Carregando integrantes…" />
        ) : members.isError ? (
          <ErrorState onRetry={() => void members.refetch()} />
        ) : active.length === 0 && inactive.length === 0 ? (
          <EmptyState>
            {text.trim() ? 'Ninguém encontrado com esse nome.' : 'Nenhum integrante cadastrado.'}
          </EmptyState>
        ) : (
          <>
            <MemberList members={active} showPhone={canViewContacts} me={me} />
            {inactive.length > 0 && (
              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Inativos ({inactive.length})
                </h2>
                <MemberList members={inactive} showPhone={canViewContacts} me={me} />
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

function MemberList({
  members,
  showPhone,
  me,
}: {
  members: Member[];
  showPhone: boolean;
  me: ResetActor | null;
}) {
  const { session } = useSession();
  if (members.length === 0) return null;
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {members.map((m) => {
        const role = ROLE_LABEL[m.role];
        const href = m.phone ? telHref(m.phone) : null;
        return (
          <li
            key={m.id}
            className="flex items-start gap-3 rounded-xl border bg-card p-4 data-[inactive=true]:opacity-70"
            data-inactive={!m.active}
          >
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground"
            >
              {m.name.charAt(0).toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-semibold">
                {m.name}
                {m.id === session?.user.id && (
                  <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground">
                    você
                  </span>
                )}
              </span>
              {m.name !== m.fullName && m.fullName && (
                <span className="text-sm text-muted-foreground">{m.fullName}</span>
              )}
              <span className="flex flex-wrap gap-1.5">
                {role && (
                  <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    {role}
                  </span>
                )}
                {m.sections.map((s) => (
                  <span
                    key={s}
                    className="rounded-md border border-accent px-2 py-0.5 text-xs font-medium"
                  >
                    {SECTION_BADGE[s]}
                  </span>
                ))}
                {m.functions.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Sem função definida</span>
                ) : (
                  m.functions.map((fn) => (
                    <span
                      key={fn}
                      className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                    >
                      {fn}
                    </span>
                  ))
                )}
              </span>
              {showPhone &&
                m.phone &&
                (href ? (
                  <a
                    href={href}
                    className="inline-flex items-center gap-1.5 self-start rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Phone aria-hidden="true" className="size-3.5" />
                    {m.phone}
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <Phone aria-hidden="true" className="size-3.5" />
                    {m.phone}
                  </span>
                ))}
              {canResetPassword(me, m) && <ResetPasswordButton memberId={m.id} name={m.name} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
