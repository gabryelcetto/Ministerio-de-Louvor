/**
 * Tipos do app escritos à mão, por cima dos tipos GERADOS do banco.
 *
 * - `database.types.ts` é gerado (não edite):
 *     npx supabase gen types typescript --local > src/types/database.types.ts
 * - O gerador não enxerga CHECK constraints: colunas como `events.type` (check in
 *   ('culto','ensaio','evento')) saem como `string`. Aqui elas são estreitadas para as uniões do
 *   domínio, e `AppDatabase` é o tipo usado pelo cliente Supabase (`src/lib/supabase.ts`).
 * - O formato do JSON de `get_dashboard()` também mora aqui (no banco o retorno é `jsonb`).
 */
import type { Database as GeneratedDatabase, Json } from './database.types';

export type { Json };

export type AccessRole = GeneratedDatabase['public']['Enums']['access_role'];
export type ProfileStatus = 'active' | 'inactive';
export type EventType = 'culto' | 'ensaio' | 'evento';
export type EventStatus = 'scheduled' | 'cancelled';
export type ReviewStatus = 'official' | 'pending';
export type VersionField = 'lyrics' | 'chords' | 'official_key' | 'metadata';
export type ChangeType = 'create' | 'update' | 'restore';
export type Audience = 'all' | 'function' | 'event' | 'users';
export type PermissionEffect = 'grant' | 'deny';
export type PermissionKey =
  | 'schedules.manage'
  | 'events.manage'
  | 'announcements.manage'
  | 'songs.delete'
  | 'chords.edit_official'
  | 'songs.set_official_key'
  | 'members.view_contacts'
  | 'members.manage'
  | 'permissions.manage'
  | 'history.restore'
  | 'history.view_all'
  | 'songs.manage'
  | 'media.manage';

// ---------------------------------------------------------------------------------------------
// Estreitamento das colunas com CHECK
// ---------------------------------------------------------------------------------------------
type GenPublic = GeneratedDatabase['public'];
type GenTables = GenPublic['Tables'];

/** Troca o tipo das colunas listadas mantendo opcionalidade e `null` do original. */
type Retype<Obj, Cols> = {
  [K in keyof Obj]: K extends keyof Cols ? Cols[K] | Extract<Obj[K], null> : Obj[K];
};

type NarrowTable<Name extends keyof GenTables, Cols> = {
  Row: Retype<GenTables[Name]['Row'], Cols>;
  Insert: Retype<GenTables[Name]['Insert'], Cols>;
  Update: Retype<GenTables[Name]['Update'], Cols>;
  Relationships: GenTables[Name]['Relationships'];
};

type Narrowed = {
  profiles: NarrowTable<'profiles', { status: ProfileStatus }>;
  user_permissions: NarrowTable<'user_permissions', { effect: PermissionEffect }>;
  events: NarrowTable<'events', { type: EventType; status: EventStatus }>;
  song_chords: NarrowTable<'song_chords', { review_status: ReviewStatus }>;
  song_versions: NarrowTable<'song_versions', { field: VersionField; change_type: ChangeType }>;
  announcements: NarrowTable<'announcements', { audience: Audience }>;
};

/** Banco usado pelo cliente: o gerado, com as colunas de domínio estreitadas. */
export type AppDatabase = Omit<GeneratedDatabase, 'public'> & {
  public: Omit<GenPublic, 'Tables'> & {
    Tables: Omit<GenTables, keyof Narrowed> & Narrowed;
  };
};

type AppTables = AppDatabase['public']['Tables'];
export type TableRow<Name extends keyof AppTables> = AppTables[Name]['Row'];

/** Colunas de profiles que o app lê (phone NÃO: só via get_member_contacts). */
export type ProfileRow = Omit<TableRow<'profiles'>, 'phone'>;
export type EventRow = TableRow<'events'>;
export type SongRow = TableRow<'songs'>;
export type AnnouncementRow = TableRow<'announcements'>;
export type MinistryFunctionRow = TableRow<'ministry_functions'>;

// ---------------------------------------------------------------------------------------------
// get_dashboard() (migration 20261119070300_communication.sql)
// ---------------------------------------------------------------------------------------------
export interface DashboardAssignment {
  assignment_id: string;
  event_id: string;
  event_title: string;
  event_type: EventType;
  starts_at: string;
  location: string | null;
  function: string;
}

export interface DashboardSong {
  song_id: string;
  title: string;
  artist: string | null;
  position: number;
  /** Já resolvido no banco: tom do dia > tom oficial > tom original. */
  key: string | null;
}

export interface DashboardAnnouncement {
  id: string;
  title: string;
  body: string;
  published_at: string;
  /** "Fixar no topo" ainda valendo (vem primeiro). */
  pinned?: boolean;
}

export interface Dashboard {
  next_service: EventRow | null;
  next_rehearsal: EventRow | null;
  my_assignments: DashboardAssignment[];
  next_service_songs: DashboardSong[];
  recent_announcements: DashboardAnnouncement[];
  unread_notifications: number;
}
