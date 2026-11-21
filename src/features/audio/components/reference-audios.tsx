import { Upload } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { friendlyError } from '@/lib/errors';
import { extensionFor } from '@/lib/audio/format';
import { audioFileProblem, formatBytes, MAX_AUDIO_BYTES } from '@/lib/audio/limits';
import { formatSemitoneShift } from '@/lib/audio/semitones';
import { readAudioDuration, useSongReferences, useUploadAudio } from '../api';
import { MediaList } from './media-list';

/**
 * Áudio de referência da música (não expira). O tom do player acompanha o tom escolhido na
 * cifra: `followSemitones` = diferença do tom original para o tom na tela.
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
  const [problem, setProblem] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [lastFile, setLastFile] = useState<File | null>(null);

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
    upload.mutate({
      blob: file,
      mimeType: file.type || 'audio/mpeg',
      extension: extensionFor(file.type, file.name),
      durationSeconds: duration,
      onProgress: setProgress,
    });
  };

  return (
    <section aria-labelledby={`${id}-titulo`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-titulo`} className="text-lg font-semibold">
          Áudio de referência
        </h2>
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
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
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void send(file);
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Até {formatBytes(MAX_AUDIO_BYTES)} por arquivo. O tom do áudio acompanha o tom escolhido na
        cifra
        {followSemitones !== null && shownKey
          ? ` (agora ${shownKey}: ${formatSemitoneShift(followSemitones)})`
          : ''}
        .
      </p>
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      {upload.isPending && (
        <div className="flex items-center gap-2">
          <progress
            max={1}
            value={progress}
            aria-label="Progresso do envio"
            className="h-3 w-full accent-[var(--primary)]"
          />
          <span className="w-12 text-right text-sm tabular-nums">
            {Math.round(progress * 100)}%
          </span>
        </div>
      )}
      {upload.isError && (
        <p role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
          {friendlyError(upload.error, 'Não foi possível enviar o áudio.')}
          {lastFile && (
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
          followLabel={
            followSemitones !== null && shownKey
              ? `${shownKey}: ${formatSemitoneShift(followSemitones)}`
              : undefined
          }
          emptyText="Nenhum áudio de referência ainda."
        />
      )}
    </section>
  );
}
