import { describe, expect, it } from 'vitest';
import type { EventDetail } from './api';
import { eventIcs, eventShareText } from './share-text';

const detail: EventDetail = {
  event: {
    id: 'ev1',
    type: 'culto',
    title: 'Culto de domingo',
    starts_at: '2026-11-22T22:00:00Z',
    ends_at: '2026-11-23T00:00:00Z',
    location: 'Templo',
    status: 'scheduled',
    notes: null,
  },
  team: [],
  teamBySection: [
    {
      section: 'vocal',
      label: 'Cantores',
      members: [
        { userId: 'u1', name: 'Lucas', initials: 'L', functions: ['Vocal principal'], notes: [] },
      ],
    },
    {
      section: 'instrumental',
      label: 'Instrumentistas',
      members: [{ userId: 'u2', name: 'Isa', initials: 'I', functions: [], notes: [] }],
    },
    { section: 'outros', label: 'Outras funções', members: [] },
  ],
  songs: [
    {
      id: 's1',
      position: 1,
      notes: null,
      songId: 'm1',
      title: 'Grande é o Senhor',
      artist: null,
      key: 'B',
      keySource: 'event',
    },
    {
      id: 's2',
      position: 2,
      notes: null,
      songId: 'm2',
      title: 'Sem tom',
      artist: null,
      key: null,
      keySource: 'none',
    },
  ] as EventDetail['songs'],
};

describe('texto do evento para o WhatsApp', () => {
  it('evento, data, hora, local, equipe por grupo, repertório com tom e link', () => {
    expect(eventShareText(detail, 'https://app.exemplo/')).toBe(
      [
        '*Culto de domingo*',
        'Domingo, 22 de novembro, 19:00–21:00',
        'Local: Templo',
        '',
        '*Cantores*',
        '- Lucas (Vocal principal)',
        '',
        '*Instrumentistas*',
        '- Isa',
        '',
        '*Repertório*',
        '1. Grande é o Senhor (tom B)',
        '2. Sem tom',
        '',
        'Abrir no app: https://app.exemplo/escalas/ev1',
      ].join('\n'),
    );
  });

  it('cancelado, sem local, sem equipe e sem repertório', () => {
    const text = eventShareText(
      {
        ...detail,
        event: { ...detail.event, status: 'cancelled', location: null },
        teamBySection: [],
        songs: [],
      },
      'https://app.exemplo',
    );
    expect(text.split('\n')).toEqual([
      '*Culto de domingo*',
      '(evento cancelado)',
      'Domingo, 22 de novembro, 19:00–21:00',
      '',
      'Abrir no app: https://app.exemplo/escalas/ev1',
    ]);
  });

  it('.ics do evento com a equipe na descrição (sem os asteriscos)', () => {
    const ics = eventIcs(detail, 'https://app.exemplo', new Date('2026-11-20T00:00:00Z'));
    expect(ics).toContain('SUMMARY:Culto de domingo');
    expect(ics).toContain('UID:ev1@louvor-advop');
    expect(ics).toContain('DTSTART;TZID=America/Sao_Paulo:20261122T190000');
    expect(ics).toContain('LOCATION:Templo');
    expect(ics).toContain('URL:https://app.exemplo/escalas/ev1');
    expect(ics).not.toContain('*');
    expect(ics.replace(/\r\n /g, '')).toContain('Cantores\\n- Lucas (Vocal principal)');
  });
});
