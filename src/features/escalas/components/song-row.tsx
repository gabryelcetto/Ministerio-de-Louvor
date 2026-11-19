import { Link } from 'react-router';
import type { EventSongItem } from '../api';

const KEY_SOURCE_LABEL: Record<NonNullable<EventSongItem['keySource']>, string> = {
  event: 'tom do dia',
  official: 'tom oficial',
  original: 'tom original',
};

/** Linha do repertório de um evento: posição, música e tom do dia em destaque. */
export function SongRow({
  song,
}: {
  song: Pick<EventSongItem, 'position' | 'songId' | 'title' | 'artist' | 'key'> & {
    notes?: string | null;
    keySource?: EventSongItem['keySource'];
  };
}) {
  return (
    <Link
      to={`/repertorio/${song.songId}`}
      className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
      >
        {song.position}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{song.title}</span>
        {song.artist && (
          <span className="truncate text-sm text-muted-foreground">{song.artist}</span>
        )}
        {song.notes && <span className="text-sm text-muted-foreground">{song.notes}</span>}
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="min-w-10 rounded-md bg-primary px-2 py-1 text-center text-sm font-bold text-primary-foreground">
          <span className="sr-only">Tom: </span>
          {song.key ?? <span title="Tom não definido">—</span>}
        </span>
        {song.keySource && (
          <span className="mt-0.5 text-[0.7rem] text-muted-foreground">
            {KEY_SOURCE_LABEL[song.keySource]}
          </span>
        )}
      </span>
    </Link>
  );
}
