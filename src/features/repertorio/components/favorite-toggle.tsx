import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToggleFavorite } from '../api';

/** Estrela de favorita (lista do repertório e tela da música). */
export function FavoriteToggle({
  songId,
  title,
  favorite,
}: {
  songId: string;
  title: string;
  favorite: boolean;
}) {
  const toggle = useToggleFavorite();
  return (
    <button
      type="button"
      aria-pressed={favorite}
      onClick={() => toggle.mutate({ songId, on: !favorite })}
      className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Star
        aria-hidden="true"
        className={cn('size-5', favorite && 'fill-current text-brand-text')}
      />
      <span className="sr-only">Favorita: {title}</span>
    </button>
  );
}
