import { Link } from 'react-router';
import { KeyChip } from '@/components/common/key-chip';
import { formatShortDate } from '@/lib/dates';
import { useSongPlays } from '../api';

/** "Tocada em": as últimas 5 vezes que a música entrou num evento (e o total). */
export function PlayedIn({ songId }: { songId: string }) {
  const plays = useSongPlays(songId);
  if (plays.isPending || plays.isError) return null;
  const { total, recent } = plays.data;
  return (
    <section
      aria-labelledby="tocada-em"
      className="flex flex-col gap-2 rounded-xl border bg-card p-4 text-sm"
    >
      <h2 id="tocada-em" className="section-label">
        Tocada em
      </h2>
      {total === 0 ? (
        <p className="text-muted-foreground">Ainda não entrou no repertório de nenhum evento.</p>
      ) : (
        <>
          <p className="text-muted-foreground">
            {total === 1 ? 'Tocada 1 vez.' : `Tocada ${total} vezes.`}
          </p>
          <ul className="flex flex-col divide-y">
            {recent.map((play) => (
              <li key={play.id}>
                <Link
                  to={`/escalas/${play.id}`}
                  className="flex min-h-11 items-center gap-3 py-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="w-24 shrink-0 text-muted-foreground">
                    {formatShortDate(play.starts_at)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{play.title}</span>
                  {play.key && <KeyChip value={play.key} label="Tom do dia" />}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
