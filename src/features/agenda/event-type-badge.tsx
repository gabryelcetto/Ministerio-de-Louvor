import { cn } from '@/lib/utils';
import type { EventType } from '@/types/database.types';
import { EVENT_TYPE_STYLES } from './event-type';

export function EventTypeBadge({ type, className }: { type: EventType; className?: string }) {
  const { label, icon: Icon, badge } = EVENT_TYPE_STYLES[type];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        badge,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </span>
  );
}

export function CancelledBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">
      Cancelado
    </span>
  );
}
