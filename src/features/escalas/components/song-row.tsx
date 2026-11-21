import { Link } from 'react-router';
import { KeyChip } from '@/components/common/key-chip';
import type { EventSongItem } from '../api';
import { songInEventHref } from '../schedule-utils';

/** Linha do repertório de um evento: número, música e o chip do tom do dia. */
export function SongRow({
  song,
  eventId,
}: {
  song: Pick<EventSongItem, 'position' | 'songId' | 'title' | 'artist' | 'key'> & {
    notes?: string | null;
  };
  eventId?: string;
}) {
  return (
    <Link
      to={songInEventHref(song.songId, song.key, eventId)}
      className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-chip text-xs font-bold text-muted-foreground"
      >
        {song.position}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{song.title}</span>
        {song.artist && (
          <span className="truncate text-sm text-muted-foreground">{song.artist}</span>
        )}
        {song.notes && <span className="text-sm text-muted-foreground">{song.notes}</span>}
      </span>
      <KeyChip value={song.key} label="Tom do dia" />
    </Link>
  );
}
