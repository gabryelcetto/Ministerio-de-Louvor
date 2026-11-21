import { useState } from 'react';
import { useRenameAudio, type MediaKind } from '../api';
import { AudioLabelDialog } from './audio-label-dialog';

/** Estado do diálogo de nome numa seção de áudios (depois de enviar ou ao renomear). */
export function useAudioNaming(kind: MediaKind, targetId: string) {
  const rename = useRenameAudio(kind, targetId);
  const [editing, setEditing] = useState<{
    id: string;
    label: string | null;
    isNew: boolean;
  } | null>(null);

  const open = (id: string, label: string | null, isNew: boolean) => {
    rename.reset();
    setEditing({ id, label, isNew });
  };

  const dialog = editing ? (
    <AudioLabelDialog
      key={editing.id}
      isNew={editing.isNew}
      initial={editing.label}
      busy={rename.isPending}
      error={rename.error}
      onCancel={() => setEditing(null)}
      onSave={(label) => {
        if (label === editing.label) {
          setEditing(null);
          return;
        }
        rename.mutate({ id: editing.id, label }, { onSuccess: () => setEditing(null) });
      }}
    />
  ) : null;

  return { open, dialog };
}
