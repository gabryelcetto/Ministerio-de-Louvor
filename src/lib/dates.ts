/**
 * Datas sempre no fuso da igreja (o mesmo que os triggers de notificação usam no banco),
 * independente do fuso do aparelho de quem abre o app.
 */
export const APP_TIME_ZONE = 'America/Sao_Paulo';

const dayKeyFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: APP_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
});

const longDateFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: APP_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const shortDateFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: APP_TIME_ZONE,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

const hourFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  hour: 'numeric',
  hourCycle: 'h23',
});

const weekdayShortFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: APP_TIME_ZONE,
  weekday: 'short',
});

const dayOfMonthFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: APP_TIME_ZONE,
  day: 'numeric',
});

const toDate = (value: string | Date) => (typeof value === 'string' ? new Date(value) : value);

/** "2026-11-23": identifica o dia no fuso da igreja (bom para agrupar). */
export function dayKey(value: string | Date): string {
  return dayKeyFormat.format(toDate(value));
}

/** "19:30" */
export function formatTime(value: string | Date): string {
  return timeFormat.format(toDate(value));
}

/** "domingo, 23 de novembro" */
export function formatLongDate(value: string | Date): string {
  return longDateFormat.format(toDate(value));
}

/** "dom., 23/11" */
export function formatShortDate(value: string | Date): string {
  return shortDateFormat.format(toDate(value));
}

/** "19:30–21:30" ou só "19:30" quando não há término. */
export function formatTimeRange(startsAt: string, endsAt: string | null): string {
  return endsAt ? `${formatTime(startsAt)}–${formatTime(endsAt)}` : formatTime(startsAt);
}

/** "Hoje", "Amanhã" ou "domingo, 23 de novembro". */
export function formatDayLabel(value: string | Date, now: Date = new Date()): string {
  const key = dayKey(value);
  if (key === dayKey(now)) return 'Hoje';
  if (key === dayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000))) return 'Amanhã';
  const label = formatLongDate(value);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Saudação pela hora no fuso da igreja. */
export function greeting(now: Date = new Date()): string {
  const hour = Number(hourFormat.format(now));
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Agrupa itens por dia (fuso da igreja), mantendo a ordem de entrada. */
export function groupByDay<T>(
  items: readonly T[],
  getDate: (item: T) => string,
): { day: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = dayKey(getDate(item));
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  return [...groups].map(([day, list]) => ({ day, items: list }));
}

const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Diferença (ms) entre o relógio de São Paulo e o UTC num instante. */
function zoneOffsetMs(instant: number): number {
  const parts = Object.fromEntries(
    partsFormat.formatToParts(new Date(instant)).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * "2026-11-23T19:30" digitado num <input type="datetime-local"> → instante ISO, lendo o horário
 * como de São Paulo (e não do fuso do aparelho). `null` se o texto não for uma data.
 */
export function zonedLocalToIso(local: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Duas passadas resolvem a virada de horário de verão (se o Brasil voltar a ter).
  let instant = guess - zoneOffsetMs(guess);
  instant = guess - zoneOffsetMs(instant);
  return new Date(instant).toISOString();
}

/** Instante → "2026-11-23T19:30" no relógio de São Paulo (valor de datetime-local). */
export function isoToZonedLocal(value: string | Date): string {
  const parts = Object.fromEntries(
    partsFormat.formatToParts(toDate(value)).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Bloco de data dos cards de evento: { weekday: "DOM", day: "23" } (fuso da igreja). */
export function dateBlock(value: string | Date): { weekday: string; day: string } {
  const date = toDate(value);
  return {
    weekday: weekdayShortFormat.format(date).replace('.', '').toUpperCase(),
    day: dayOfMonthFormat.format(date),
  };
}

/**
 * "Repetir toda semana por N semanas": as datas, no mesmo horário de São Paulo (como o banco
 * faz em create_event_with_team). Valor de datetime-local → instantes ISO.
 */
export function weeklyOccurrences(local: string, weeks: number): string[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!match || weeks < 1) return [];
  const [, y, mo, d, h, mi] = match;
  const out: string[] = [];
  for (let i = 0; i < weeks; i++) {
    const day = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d) + 7 * i));
    const iso = day.toISOString().slice(0, 10);
    const instant = zonedLocalToIso(`${iso}T${h}:${mi}`);
    if (instant) out.push(instant);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Meses (agenda): "2026-11" no fuso da igreja.
// ---------------------------------------------------------------------------------------------
const MONTH_RE = /^(\d{4})-(\d{2})$/;
const monthNameFormat = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' });

/** Mês de agora (ou da data) no fuso de São Paulo: "2026-11". */
export function monthKey(value: string | Date = new Date()): string {
  return dayKey(value).slice(0, 7);
}

/** "2026-11" é um mês válido? */
export function isMonthKey(value: string | null | undefined): value is string {
  const m = MONTH_RE.exec(value ?? '');
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

/** Soma (ou subtrai) meses: addMonths("2026-12", 1) = "2027-01". */
export function addMonths(month: string, delta: number): string {
  const [, y, m] = MONTH_RE.exec(month) ?? [];
  const index = Number(y) * 12 + (Number(m) - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** Início e fim (exclusivo) do mês, em instantes ISO, no horário de São Paulo. */
export function monthRange(month: string): { from: string; to: string } {
  return {
    from: zonedLocalToIso(`${month}-01T00:00`)!,
    to: zonedLocalToIso(`${addMonths(month, 1)}-01T00:00`)!,
  };
}

/** "novembro de 2026". */
export function formatMonthLabel(month: string): string {
  const [, y, m] = MONTH_RE.exec(month) ?? [];
  const name = monthNameFormat.format(new Date(Date.UTC(Number(y), Number(m) - 1, 15)));
  return `${name} de ${y}`;
}
