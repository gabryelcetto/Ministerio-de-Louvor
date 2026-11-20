import { CalendarHeart, Church, Music2, type LucideIcon } from 'lucide-react';
import type { EventType } from '@/types/app.types';

interface EventTypeStyle {
  label: string;
  icon: LucideIcon;
  /** Faixa lateral (borda esquerda) na cor do tipo. */
  bar: string;
  /** Texto/ícone na cor do tipo. */
  text: string;
  /** Selo com fundo suave e texto na cor do tipo. */
  badge: string;
}

/** Cor + ícone + rótulo: o tipo nunca depende só da cor (acessibilidade). */
export const EVENT_TYPE_STYLES: Record<EventType, EventTypeStyle> = {
  culto: {
    label: 'Culto',
    icon: Church,
    bar: 'border-l-event-culto',
    text: 'text-event-culto',
    badge: 'bg-event-culto-soft text-event-culto',
  },
  ensaio: {
    label: 'Ensaio',
    icon: Music2,
    bar: 'border-l-event-ensaio',
    text: 'text-event-ensaio',
    badge: 'bg-event-ensaio-soft text-event-ensaio',
  },
  evento: {
    label: 'Evento',
    icon: CalendarHeart,
    bar: 'border-l-event-evento',
    text: 'text-event-evento',
    badge: 'bg-event-evento-soft text-event-evento',
  },
};
