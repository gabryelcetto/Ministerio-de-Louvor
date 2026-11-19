/**
 * Tipos do banco no formato do `supabase gen types typescript`.
 * ESCRITO À MÃO a partir de supabase/migrations (ver docs/pendencias.md).
 * Quando o Supabase local estiver disponível, substitua com:
 *   npx supabase gen types typescript --local > src/types/database.types.ts
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamp = string;
type Uuid = string;

/** Gera Row/Insert/Update/Relationships: Insert exige só as colunas obrigatórias. */
type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type AccessRole = 'admin' | 'leader' | 'member';
export type ProfileStatus = 'active' | 'inactive';
export type EventType = 'culto' | 'ensaio' | 'evento';
export type EventStatus = 'scheduled' | 'cancelled';
export type ReviewStatus = 'official' | 'pending';
export type VersionField = 'lyrics' | 'chords' | 'official_key' | 'metadata';
export type ChangeType = 'create' | 'update' | 'restore';
export type Audience = 'all' | 'function' | 'event' | 'users';
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
  | 'history.restore';

/** Colunas de profiles legíveis pela API (phone só via get_member_contacts). */
export interface ProfileRow {
  id: Uuid;
  full_name: string;
  display_name: string | null;
  access_role: AccessRole;
  is_owner: boolean;
  status: ProfileStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface EventRow {
  id: Uuid;
  type: EventType;
  title: string;
  starts_at: Timestamp;
  ends_at: Timestamp | null;
  location: string | null;
  notes: string | null;
  status: EventStatus;
  created_by: Uuid | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface SongRow {
  id: Uuid;
  title: string;
  artist: string | null;
  category: string | null;
  original_key: string | null;
  official_key: string | null;
  media_url: string | null;
  notes: string | null;
  created_by: Uuid | null;
  archived_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface AnnouncementRow {
  id: Uuid;
  title: string;
  body: string;
  published_at: Timestamp;
  audience: Audience;
  created_by: Uuid | null;
  created_at: Timestamp;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: never;
        Update: Partial<Pick<ProfileRow, 'full_name' | 'display_name' | 'access_role' | 'status'>> & {
          phone?: string | null;
        };
        Relationships: [];
      };
      permissions: Table<{ key: string; description: string }, 'key' | 'description'>;
      role_permissions: Table<{ role: AccessRole; permission_key: string }, 'role' | 'permission_key'>;
      user_permissions: Table<
        { user_id: Uuid; permission_key: string; effect: 'grant' | 'deny' },
        'user_id' | 'permission_key' | 'effect'
      >;
      ministry_functions: Table<{ id: number; name: string; sort_order: number }, 'name'>;
      member_functions: Table<{ user_id: Uuid; function_id: number }, 'user_id' | 'function_id'>;
      audit_logs: Table<
        {
          id: number;
          actor_id: Uuid | null;
          action: string;
          entity: string;
          entity_id: string | null;
          details: Json;
          created_at: Timestamp;
        },
        'action' | 'entity'
      >;
      events: Table<EventRow, 'type' | 'title' | 'starts_at'>;
      event_assignments: Table<
        {
          id: Uuid;
          event_id: Uuid;
          user_id: Uuid;
          function_id: number;
          notes: string | null;
          created_at: Timestamp;
        },
        'event_id' | 'user_id' | 'function_id'
      >;
      songs: Table<SongRow, 'title'>;
      song_lyrics: Table<
        { song_id: Uuid; content: string; updated_by: Uuid | null; updated_at: Timestamp },
        'song_id'
      >;
      song_chords: Table<
        {
          song_id: Uuid;
          content: string;
          review_status: ReviewStatus;
          updated_by: Uuid | null;
          updated_at: Timestamp;
        },
        'song_id'
      >;
      song_versions: {
        Row: {
          id: Uuid;
          song_id: Uuid;
          field: VersionField;
          old_value: string | null;
          new_value: string | null;
          change_type: ChangeType;
          changed_by: Uuid | null;
          changed_at: Timestamp;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      song_favorites: Table<{ user_id: Uuid; song_id: Uuid; created_at: Timestamp }, 'song_id'>;
      event_songs: Table<
        {
          id: Uuid;
          event_id: Uuid;
          song_id: Uuid;
          position: number;
          key_for_event: string | null;
          notes: string | null;
        },
        'event_id' | 'song_id'
      >;
      announcements: Table<AnnouncementRow, 'title'>;
      notifications: {
        Row: {
          id: Uuid;
          user_id: Uuid;
          type: string;
          title: string;
          body: string | null;
          link: string | null;
          read_at: Timestamp | null;
          created_at: Timestamp;
        };
        Insert: never;
        Update: { read_at?: Timestamp | null };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      has_permission: { Args: { p: string }; Returns: boolean };
      is_active_member: { Args: Record<string, never>; Returns: boolean };
      my_permissions: { Args: Record<string, never>; Returns: string[] };
      get_member_contacts: {
        Args: Record<string, never>;
        Returns: { id: Uuid; phone: string | null }[];
      };
      search_songs: { Args: { q: string }; Returns: SongRow[] };
      restore_song_version: { Args: { version_id: Uuid }; Returns: undefined };
      get_dashboard: { Args: Record<string, never>; Returns: Json };
    };
    Enums: { access_role: AccessRole };
    CompositeTypes: Record<string, never>;
  };
}
