import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormError } from '@/components/common/form-error';
import { Button } from '@/components/ui/button';
import { useSongCategories } from '../api';
import {
  songDataDefaults,
  songDataSchema,
  useSetSongArchived,
  useUpdateSongData,
  type SongDataValues,
} from '../song-data';
import { SongDataFields } from './song-data-fields';
import { useSingleFlight } from '@/hooks/use-single-flight';

type SongLike = Parameters<typeof songDataDefaults>[0] & { id: string };

/** "Editar dados" (songs.manage): título, artista, categoria, tom original, link, observações. */
export function SongDataEditor({
  song,
  onDone,
}: {
  song: SongLike;
  onDone: (saved: boolean) => void;
}) {
  const categories = useSongCategories();
  const save = useUpdateSongData(song.id);
  const once = useSingleFlight({ keepLockedOnSuccess: true });
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<SongDataValues>({
    resolver: zodResolver(songDataSchema),
    defaultValues: songDataDefaults(song),
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => {
        void once(async () => {
          await save.mutateAsync(values);
          onDone(true);
        }).catch(() => undefined); // o erro aparece pelo save.error
      })}
      className="flex flex-col gap-4 rounded-lg border p-4"
    >
      <h2 className="font-semibold">Editar dados da música</h2>
      <SongDataFields register={register} errors={errors} categories={categories.data ?? []} />
      <FormError error={save.error} fallback="Não foi possível salvar os dados." />
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onDone(false)}
          disabled={save.isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={!isDirty || save.isPending}>
          {save.isPending ? 'Salvando…' : 'Salvar dados'}
        </Button>
      </div>
    </form>
  );
}

/**
 * Excluir (arquivar) ou restaurar a música (songs.delete), aberto pelo menu ⋯. Excluir só tira
 * a música do repertório: o histórico e as escalas antigas continuam, e dá para restaurar.
 */
export function ArchiveSongDialog({
  songId,
  title,
  archived,
  open,
  onClose,
}: {
  songId: string;
  title: string;
  archived: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const mutation = useSetSongArchived(songId);
  return (
    <>
      <FormError
        error={mutation.error}
        fallback={archived ? 'Não foi possível restaurar.' : 'Não foi possível excluir.'}
      />
      <ConfirmDialog
        open={open}
        title={archived ? 'Restaurar esta música?' : 'Excluir esta música?'}
        confirmLabel={archived ? 'Restaurar' : 'Excluir'}
        destructive={!archived}
        busy={mutation.isPending}
        onCancel={onClose}
        onConfirm={() => mutation.mutate(!archived, { onSettled: onClose })}
      >
        {archived
          ? `“${title}” volta para a lista do repertório.`
          : `“${title}” sai da lista do repertório. O histórico e as escalas antigas continuam, e um administrador pode restaurar depois.`}
      </ConfirmDialog>
    </>
  );
}
