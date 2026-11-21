import { ErrorState, LoadingState } from '@/components/common/states';
import { useEventRecordings } from '../api';
import { useAudioNaming } from './use-audio-naming';
import { AudioRecorder } from './audio-recorder';
import { MediaList } from './media-list';

/** Gravações do ensaio: gravar, enviar (com progresso e nova tentativa), dar nome e ouvir. */
export function RehearsalRecordings({ eventId }: { eventId: string }) {
  const recordings = useEventRecordings(eventId);
  const naming = useAudioNaming('rehearsal', eventId);

  return (
    <section aria-labelledby="gravacoes-titulo" className="flex flex-col gap-4">
      <h2 id="gravacoes-titulo" className="text-lg font-semibold">
        Gravações do ensaio
      </h2>

      <AudioRecorder
        kind="rehearsal"
        targetId={eventId}
        startLabel="Gravar ensaio"
        large
        onUploaded={(id) => naming.open(id, null, true)}
      />

      {recordings.isPending ? (
        <LoadingState label="Carregando gravações…" />
      ) : recordings.isError ? (
        <ErrorState onRetry={() => void recordings.refetch()} />
      ) : (
        <MediaList
          items={recordings.data}
          kind="rehearsal"
          targetId={eventId}
          onRename={(item) => naming.open(item.id, item.label, false)}
          emptyText="Nenhuma gravação deste ensaio ainda."
        />
      )}
      {naming.dialog}
    </section>
  );
}
