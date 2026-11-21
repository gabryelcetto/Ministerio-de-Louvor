import { ErrorState, LoadingState } from '@/components/common/states';
import { detectPlatform } from '@/lib/install';
import { useEventRecordings } from '../api';
import { AudioRecorder } from './audio-recorder';
import { MediaList } from './media-list';
import { useAudioNaming } from './use-audio-naming';

/** iPhone/iPad: bloquear a tela (ou trocar de app) interrompe a gravação no Safari. */
function isIos(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    detectPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints) === 'ios'
  );
}

/**
 * Gravações do ensaio: lista ("Gravações deste ensaio": tocar, nome, duração, quem gravou) e
 * o dock fixo embaixo com o botão redondo de gravar. O que foi gravado fica salvo no aparelho
 * até ser enviado; depois de enviado, fica 90 dias no servidor.
 */
export function RehearsalRecordings({
  eventId,
  downloadPrefix,
}: {
  eventId: string;
  /** "Ensaio 26-11": começo do nome dos arquivos baixados. */
  downloadPrefix?: string;
}) {
  const recordings = useEventRecordings(eventId);
  const naming = useAudioNaming('rehearsal', eventId);

  return (
    <section aria-labelledby="gravacoes-titulo" className="flex flex-col gap-3">
      <h2 id="gravacoes-titulo" className="section-label">
        Gravações deste ensaio
      </h2>

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
          downloadPrefix={downloadPrefix}
        />
      )}

      <AudioRecorder
        kind="rehearsal"
        targetId={eventId}
        startLabel="Gravar ensaio"
        layout="dock"
        hint="Deixe a tela ligada enquanto grava. Fica salvo por 90 dias."
        warning={
          isIos()
            ? 'No iPhone, bloquear a tela ou trocar de app interrompe a gravação. O que já foi gravado fica salvo.'
            : undefined
        }
        onUploaded={(id) => naming.open(id, null, true)}
      />
      {naming.dialog}
    </section>
  );
}
