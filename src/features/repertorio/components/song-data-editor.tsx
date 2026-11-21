import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, ArchiveRestore } from 'lucide-react';
import { useState } from 'react';
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
      onSubmit={handleSubmit((values) => save.mutate(values, { onSuccess: () => onDone(true) }))}
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

/** Arquivar / desarquivar (songs.delete). Arquivada some da busca, mas o histórico fica. */
export function ArchiveSongButton({
  songId,
  title,
  archived,
}: {
  songId: string;
  title: string;
  archived: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const mutation = useSetSongArchived(songId);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => (archived ? mutation.mutate(false) : setConfirming(true))}
        disabled={mutation.isPending}
      >
        {archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
        {archived ? 'Desarquivar' : 'Arquivar'}
      </Button>
      <FormError error={mutation.error} fallback="Não foi possível arquivar." />
      <ConfirmDialog
        open={confirming}
        title="Arquivar esta música?"
        confirmLabel="Arquivar"
        destructive
        busy={mutation.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => mutation.mutate(true, { onSettled: () => setConfirming(false) })}
      >
        “{title}” sai da lista do repertório. O histórico e as escalas antigas continuam, e quem
        arquivou pode desarquivar.
      </ConfirmDialog>
    </>
  );
}
