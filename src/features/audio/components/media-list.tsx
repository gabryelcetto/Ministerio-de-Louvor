import { Check, Headphones, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormError } from '@/components/common/form-error';
import { Button } from '@/components/ui/button';
import { useSession, usePermission } from '@/features/auth';
import { formatBytes, formatDuration } from '@/lib/audio/limits';
import { formatShortDate, formatTime } from '@/lib/dates';
import { mediaTitle, useDeleteAudio, type MediaItem, type MediaKind } from '../api';
import { AudioPlayer } from './audio-player';

/**
 * Lista de áudios com nome, player, autor e duração. Renomear e apagar: só o autor ou o admin
 * (media.manage) — a interface só esconde; quem decide é o banco.
 */
export function MediaList({
  items,
  kind,
  targetId,
  followSemitones,
  followLabel,
  onRename,
  onSelect,
  selectedId,
  emptyText,
}: {
  items: MediaItem[];
  kind: MediaKind;
  targetId: string;
  followSemitones?: number | null;
  followLabel?: string;
  onRename?: (item: MediaItem) => void;
  /**
   * Modo "escolher" (tela da música): em vez de um player por áudio, um botão que põe o áudio
   * no player do dock, embaixo da tela.
   */
  onSelect?: (item: MediaItem) => void;
  selectedId?: string | null;
  emptyText: string;
}) {
  const { session } = useSession();
  const canDeleteAny = usePermission('media.manage');
  const remove = useDeleteAudio(kind, targetId);
  const [pending, setPending] = useState<MediaItem | null>(null);

  if (items.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;

  return (
    <>
      <ul className="flex flex-col gap-3">
        {items.map((item, index) => {
          const label = mediaTitle(kind, item.label, items.length - index);
          const canEdit = canDeleteAny || item.createdBy === session?.user.id;
          return (
            <li key={item.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium">{label}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {item.author ?? 'alguém'} · {formatShortDate(item.createdAt)} às{' '}
                    {formatTime(item.createdAt)}
                    {item.durationSeconds !== null && ` · ${formatDuration(item.durationSeconds)}`}
                    {` · ${formatBytes(item.sizeBytes)}`}
                  </span>
                </span>
                {canEdit && (
                  <span className="flex gap-1">
                    {onRename && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onRename(item)}
                        aria-label={`Renomear ${label}`}
                      >
                        <Pencil aria-hidden="true" />
                        Renomear
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPending(item)}
                      aria-label={`Apagar ${label}`}
                    >
                      <Trash2 aria-hidden="true" />
                      Apagar
                    </Button>
                  </span>
                )}
              </div>
              {onSelect ? (
                <Button
                  type="button"
                  variant={selectedId === item.id ? 'secondary' : 'outline'}
                  className="self-start"
                  aria-pressed={selectedId === item.id}
                  onClick={() => onSelect(item)}
                >
                  {selectedId === item.id ? (
                    <Check aria-hidden="true" />
                  ) : (
                    <Headphones aria-hidden="true" />
                  )}
                  {selectedId === item.id ? 'No player' : 'Ouvir no player'}
                  <span className="sr-only">: {label}</span>
                </Button>
              ) : item.url ? (
                <AudioPlayer
                  src={item.url}
                  label={label}
                  durationSeconds={item.durationSeconds}
                  followSemitones={followSemitones}
                  followLabel={followLabel}
                />
              ) : (
                <p className="text-sm text-destructive">
                  Link do áudio indisponível. Recarregue a página.
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <FormError error={remove.error} fallback="Não foi possível apagar o áudio." />
      <ConfirmDialog
        open={pending !== null}
        title="Apagar este áudio?"
        confirmLabel="Apagar"
        destructive
        busy={remove.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) remove.mutate(pending, { onSettled: () => setPending(null) });
        }}
      >
        O arquivo sai do armazenamento e não dá para desfazer.
      </ConfirmDialog>
    </>
  );
}
