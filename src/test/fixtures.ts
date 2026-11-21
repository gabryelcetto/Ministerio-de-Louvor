/**
 * Dados de exemplo (fictícios) para os testes de tela: um ministério pequeno com admin, uma
 * integrante, músicas com letra e cifra, um culto e um ensaio com equipe e repertório.
 */
import type { Session } from '@supabase/supabase-js';
import type { FakeState } from './fake-supabase';

export const ADMIN_ID = 'a0000000-0000-4000-8000-000000000001';
export const MEMBER_ID = 'a0000000-0000-4000-8000-000000000002';
export const OTHER_ID = 'a0000000-0000-4000-8000-000000000003';
export const SONG_ID = 'b0000000-0000-4000-8000-000000000001';
export const SONG2_ID = 'b0000000-0000-4000-8000-000000000002';
export const SERVICE_ID = 'c0000000-0000-4000-8000-000000000001';
export const REHEARSAL_ID = 'c0000000-0000-4000-8000-000000000002';

export const ALL_PERMISSIONS = [
  'schedules.manage',
  'events.manage',
  'announcements.manage',
  'songs.delete',
  'chords.edit_official',
  'songs.set_official_key',
  'members.view_contacts',
  'members.manage',
  'permissions.manage',
  'history.restore',
  'history.view_all',
  'songs.manage',
  'media.manage',
];
export const MEMBER_PERMISSIONS = [
  'chords.edit_official',
  'songs.set_official_key',
  'songs.manage',
];

/** Datas relativas a "agora": o app filtra eventos futuros. */
const inDays = (days: number, hour = 19) => {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  d.setUTCHours(hour + 3, 0, 0, 0); // hora de São Paulo
  return d.toISOString();
};

export function session(userId: string, email: string): Session {
  return {
    access_token: `token-${userId}`,
    refresh_token: 'refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: userId,
      email,
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  } as Session;
}

const profile = (
  id: string,
  full_name: string,
  display_name: string | null,
  access_role: 'admin' | 'member',
  extra: Record<string, unknown> = {},
) => ({
  id,
  full_name,
  display_name,
  access_role,
  is_owner: false,
  status: 'active',
  must_change_password: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...extra,
});

const functions = [
  { id: 1, name: 'Vocal', sort_order: 1, section: 'vocal' },
  { id: 2, name: 'Violão', sort_order: 2, section: 'instrumental' },
  { id: 3, name: 'Teclado', sort_order: 3, section: 'instrumental' },
];

const CHORDS = `[Intro] G D Em C

G           D
Quão grande és Tu
Em          C
Senhor meu Deus

[Refrão]
C       G
Então minh'alma canta`;

const LYRICS = `Quão grande és Tu
Senhor meu Deus

[Refrão]
Então minh'alma canta`;

export function baseState(as: 'admin' | 'member' | null = 'admin'): Partial<FakeState> {
  const admin = profile(ADMIN_ID, 'Ana Administradora', 'Ana', 'admin', { is_owner: true });
  const member = profile(MEMBER_ID, 'Isa Integrante', 'Isa', 'member');
  const other = profile(OTHER_ID, 'Lucas Teclado', null, 'member');
  const memberFunctions = [
    { user_id: MEMBER_ID, function_id: 1, function: functions[0] },
    { user_id: OTHER_ID, function_id: 3, function: functions[2] },
  ];
  const songs = [
    {
      id: SONG_ID,
      title: 'Grande é o Senhor',
      artist: 'Hinário',
      category: 'Adoração',
      original_key: 'G',
      official_key: 'A',
      media_url: null,
      notes: 'Começar só com voz.',
      created_by: ADMIN_ID,
      archived_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      song_lyrics: { content: LYRICS },
      song_chords: { content: CHORDS, review_status: 'official' },
    },
    {
      id: SONG2_ID,
      title: 'Música sem cifra',
      artist: null,
      category: 'Louvor',
      original_key: null,
      official_key: null,
      media_url: null,
      notes: null,
      created_by: MEMBER_ID,
      archived_at: null,
      created_at: '2026-01-03T00:00:00Z',
      updated_at: '2026-01-03T00:00:00Z',
      song_lyrics: null,
      song_chords: null,
    },
  ];
  const serviceAssignments = [
    {
      id: 'd1',
      user_id: MEMBER_ID,
      function_id: 1,
      notes: 'Abre o culto',
      profile: { id: MEMBER_ID, full_name: member.full_name, display_name: member.display_name },
      function: functions[0],
    },
    {
      id: 'd2',
      user_id: OTHER_ID,
      function_id: 3,
      notes: null,
      profile: { id: OTHER_ID, full_name: other.full_name, display_name: null },
      function: functions[2],
    },
  ];
  const events = [
    {
      id: SERVICE_ID,
      type: 'culto',
      title: 'Culto de domingo',
      starts_at: inDays(2),
      ends_at: inDays(2, 21),
      location: 'Templo',
      status: 'scheduled',
      notes: 'Chegar 1 h antes.',
      event_assignments: serviceAssignments,
      event_songs: [
        {
          id: 'e2',
          position: 2,
          key_for_event: null,
          notes: null,
          song: {
            id: SONG2_ID,
            title: 'Música sem cifra',
            artist: null,
            official_key: null,
            original_key: null,
          },
        },
        {
          id: 'e1',
          position: 1,
          key_for_event: 'B',
          notes: 'Só voz e violão',
          song: {
            id: SONG_ID,
            title: 'Grande é o Senhor',
            artist: 'Hinário',
            official_key: 'A',
            original_key: 'G',
          },
        },
      ],
    },
    {
      id: REHEARSAL_ID,
      type: 'ensaio',
      title: 'Ensaio geral',
      starts_at: inDays(1),
      ends_at: null,
      location: null,
      status: 'scheduled',
      notes: null,
      event_assignments: [],
      event_songs: [],
    },
  ];
  const me = as === 'member' ? member : admin;
  return {
    session: as ? session(me.id, as === 'member' ? 'isa@teste.local' : 'ana@teste.local') : null,
    tables: {
      profiles: [admin, member, other].map((p) => ({
        ...p,
        member_functions: memberFunctions
          .filter((m) => m.user_id === p.id)
          .map((m) => ({ function_id: m.function_id, function: m.function })),
      })),
      ministry_functions: functions,
      member_functions: memberFunctions,
      songs,
      song_lyrics: [{ song_id: SONG_ID, content: LYRICS }],
      song_chords: [{ song_id: SONG_ID, content: CHORDS, review_status: 'official' }],
      song_versions: [
        {
          id: 'v2',
          song_id: SONG_ID,
          field: 'chords',
          change_type: 'update',
          old_value: 'G D',
          new_value: CHORDS,
          changed_at: '2026-01-05T12:00:00Z',
          author: { full_name: member.full_name, display_name: 'Isa' },
        },
        {
          id: 'v0',
          song_id: SONG_ID,
          field: 'chords',
          change_type: 'create',
          old_value: null,
          new_value: 'G D',
          changed_at: '2026-01-02T12:00:00Z',
          author: { full_name: admin.full_name, display_name: 'Ana' },
        },
        {
          id: 'v1',
          song_id: SONG_ID,
          field: 'official_key',
          change_type: 'create',
          old_value: null,
          new_value: 'A',
          changed_at: '2026-01-01T12:00:00Z',
          author: { full_name: admin.full_name, display_name: 'Ana' },
        },
      ],
      events,
      event_songs: events.flatMap((e) => e.event_songs.map((es) => ({ ...es, event_id: e.id }))),
      event_assignments: [
        ...serviceAssignments.map((a) => ({
          ...a,
          event: events[0],
        })),
      ],
      notifications: [
        {
          id: 'n1',
          type: 'assignment',
          title: 'Você foi escalada',
          body: 'Culto de domingo — Vocal',
          link: `/escalas/${SERVICE_ID}`,
          read_at: null,
          created_at: inDays(-1),
        },
        {
          id: 'n2',
          type: 'announcement',
          title: 'Comunicado novo',
          body: null,
          link: null,
          read_at: inDays(-1),
          created_at: inDays(-2),
        },
      ],
      announcements: [
        {
          id: 'an1',
          title: 'Bem-vindos ao app',
          body: 'Escalas e cifras ficam aqui.',
          published_at: inDays(-3),
          pinned_until: null,
          audience_filter: { type: 'all' },
          author: { full_name: admin.full_name, display_name: 'Ana' },
        },
      ],
      announcement_reads: [],
      song_favorites: [],
      media_files: [
        {
          id: 'm1',
          kind: 'reference',
          song_id: SONG_ID,
          event_id: null,
          label: 'Voz guia',
          storage_path: `reference/${SONG_ID}/voz.mp3`,
          mime_type: 'audio/mpeg',
          duration_seconds: 125,
          size_bytes: 2_000_000,
          created_at: '2026-01-04T10:00:00Z',
          created_by: MEMBER_ID,
          author: { full_name: member.full_name, display_name: 'Isa' },
        },
      ],
    },
    rpc: {
      my_permissions: as === 'admin' ? ALL_PERMISSIONS : MEMBER_PERMISSIONS,
      preview_announcement_audience: 3,
      save_announcement: 'an-novo',
      create_event_with_team: ['ev-novo'],
      get_song_stats: [],
      get_song_plays: { total: 0, recent: [] },
      duplicate_event: 'ev-dup',
      mark_announcement_read: null,
      delete_announcement: null,
      remind_announcement: 1,
      get_announcement_audience_status: [
        {
          user_id: MEMBER_ID,
          full_name: member.full_name,
          display_name: 'Isa',
          read_at: inDays(-1),
        },
        { user_id: OTHER_ID, full_name: other.full_name, display_name: null, read_at: null },
      ],
      search_songs: songs,
      get_dashboard: {
        attention: [],
        attention_total: 0,
        next_service: events[0],
        next_rehearsal: events[1],
        my_assignments: [
          {
            assignment_id: 'd1',
            event_id: SERVICE_ID,
            event_title: 'Culto de domingo',
            event_type: 'culto',
            starts_at: events[0]!.starts_at,
            location: 'Templo',
            function: 'Vocal',
          },
        ],
        next_service_songs: [
          {
            song_id: SONG_ID,
            title: 'Grande é o Senhor',
            artist: 'Hinário',
            position: 1,
            key: 'B',
          },
        ],
        recent_announcements: [
          {
            id: 'an1',
            title: 'Bem-vindos ao app',
            body: 'Escalas e cifras ficam aqui.',
            published_at: inDays(-3),
          },
        ],
        unread_notifications: 1,
      },
      get_member_contacts: [
        { id: MEMBER_ID, phone: '(11) 98765-4321' },
        { id: OTHER_ID, phone: 'sem número' },
      ],
      get_recent_activity: [
        {
          kind: 'version',
          occurred_at: '2026-01-05T12:00:00Z',
          actor_id: MEMBER_ID,
          actor_name: 'Isa',
          song_id: SONG_ID,
          song_title: 'Grande é o Senhor',
          field: 'chords',
          change_type: 'update',
          action: null,
          version_id: 'v2',
        },
        {
          kind: 'audit',
          occurred_at: '2026-01-06T12:00:00Z',
          actor_id: ADMIN_ID,
          actor_name: 'Ana',
          song_id: SONG2_ID,
          song_title: 'Música sem cifra',
          field: null,
          change_type: null,
          action: 'archive_song',
          version_id: null,
        },
      ],
      get_storage_usage: {
        total_bytes: 800 * 1024 * 1024,
        rehearsal_bytes: 500 * 1024 * 1024,
        reference_bytes: 300 * 1024 * 1024,
        files: 12,
        limit_bytes: 1073741824,
        block_bytes: 966367641,
      },
      check_audio_upload: null,
      complete_password_change: null,
      restore_song_version: null,
      create_song: SONG2_ID,
    },
  };
}
