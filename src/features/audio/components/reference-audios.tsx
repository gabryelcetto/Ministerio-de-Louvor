import { Upload } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { friendlyError } from '@/lib/errors';
import { extensionFor } from '@/lib/audio/format';
import { audioFileProblem, formatBytes, MAX_AUDIO_BYTES } from '@/lib/audio/limits';
import { formatSemitoneShift } from '@/lib/audio/semitones';
import {
  MAX_REFERENCES_PER_SONG,
  readAudioDuration,
  useSongReferences,
  useUploadAudio,
} from '../api';
import { useAudioNaming } from './use-audio-naming';
import { AudioRecorder, UploadProgress } from './audio-recorder';
import { MediaList } from './media-list';

/**
 * Áudios de referência da música (não expiram, até 3 por música): gravar na hora ou enviar um
 * arquivo, dar nome e ouvir. O tom do player acompanha o tom escolhido na cifra:
 * `followSemitones` = diferença do tom original para o tom na tela.
 */
export function ReferenceAudios({
  songId,
  followSemitones,
  shownKey,
}: {
  songId: string;
  followSemitones: number | null;
  shownKey: string | null;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const references = useSongReferences(songId);
  const upload = useUploadAudio('reference', songId);
  const naming = useAudioNaming('reference', songId);
  const [problem, setProblem] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [lastFile, setLastFile] = useState<File | null>(null);
  // O banco recusa o 4º; aqui só evitamos que a pessoa grave ou escolha um arquivo à toa.
  const full = (references.data?.length ?? 0) >= MAX_REFERENCES_PER_SONG;

  const send = async (file: File) => {
    setProblem(null);
    const issue = audioFileProblem(file);
    if (issue) {
      setProblem(issue);
      return;
    }
    setLastFile(file);
    setProgress(0);
    const duration = await readAudioDuration(file);
    upload.mutate(
      {
        blob: file,
        mimeType: file.type || 'audio/mpeg',
        extension: extensionFor(file.type, file.name),
        durationSeconds: duration,
        onProgress: setProgress,
      },
      { onSuccess: (mediaId) => naming.open(mediaId, null, true) },
    );
  };

  const shift =
    followSemitones !== null && shownKey
      ? `${shownKey}: ${formatSemitoneShift(followSemitones)}`
      : null;

  return (
    <section aria-labelledby={`${id}-titulo`} className="flex flex-col gap-3">
      <h2 id={`${id}-titulo`} className="text-lg font-semibold">
        Áudio de referência
      </h2>

      <AudioRecorder
        kind="reference"
        targetId={songId}
        startLabel="Gravar"
        disabled={full || upload.isPending}
        onUploaded={(mediaId) => naming.open(mediaId, null, true)}
        extraActions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={full || upload.isPending}
            >
              <Upload aria-hidden="true" />
              Enviar áudio
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="audio/*"
              className="sr-only"
              aria-label="Arquivo de áudio de referência"
              disabled={full}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void send(file);
              }}
            />
          </>
        }
        hint={
          <>
            Grave na hora ou envie um arquivo (até {formatBytes(MAX_AUDIO_BYTES)}), no máximo{' '}
            {MAX_REFERENCES_PER_SONG} por música. O tom do áudio acompanha o tom escolhido na cifra
            {shift ? ` (agora ${shift})` : ''}.
          </>
        }
      />

      {full && (
        <p role="status" className="text-sm font-medium">
          Esta música já tem {MAX_REFERENCES_PER_SONG} áudios de referência. Apague um para gravar
          ou enviar outro.
        </p>
      )}
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      {upload.isPending && <UploadProgress value={progress} />}
      {upload.isError && (
        <p role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
          {friendlyError(upload.error, 'Não foi possível enviar o áudio.')}
          {lastFile && !full && (
            <Button type="button" variant="outline" size="sm" onClick={() => void send(lastFile)}>
              Tentar de novo
            </Button>
          )}
        </p>
      )}
      {references.isPending ? (
        <LoadingState label="Carregando áudios…" />
      ) : references.isError ? (
        <ErrorState onRetry={() => void references.refetch()} />
      ) : (
        <MediaList
          items={references.data}
          kind="reference"
          targetId={songId}
          followSemitones={followSemitones}
          followLabel={shift ?? undefined}
          onRename={(item) => naming.open(item.id, item.label, false)}
          emptyText="Nenhum áudio de referência ainda."
        />
      )}
      {naming.dialog}
    </section>
  );
}
