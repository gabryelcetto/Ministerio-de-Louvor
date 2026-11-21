
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "announcement_reads": {
                  Row: {
                    "announcement_id": string,"read_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "announcement_id": string,"read_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "announcement_id"?: string,"read_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcement_reads_announcement_id_fkey"
      columns: ["announcement_id"]
isOneToOne: false
      referencedRelation: "announcements"
      referencedColumns: ["id"]
    },
                    {
      foreignKeyName: "announcement_reads_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"announcement_recipients": {
                  Row: {
                    "announcement_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "announcement_id": string,"user_id": string
                  }
                  Update: {
                    "announcement_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcement_recipients_announcement_id_fkey"
      columns: ["announcement_id"]
isOneToOne: false
      referencedRelation: "announcements"
      referencedColumns: ["id"]
    },
                    {
      foreignKeyName: "announcement_recipients_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"announcements": {
                  Row: {
                    "audience": string,"audience_filter": NonNullable<Json>,"body": string,"created_at": string,"created_by": string | null,"id": string,"last_reminder_at": string | null,"pinned_until": string | null,"published_at": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audience"?: string,"audience_filter"?: NonNullable<Json>,"body"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"last_reminder_at"?: string | null,"pinned_until"?: string | null,"published_at"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "audience"?: string,"audience_filter"?: NonNullable<Json>,"body"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"last_reminder_at"?: string | null,"pinned_until"?: string | null,"published_at"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": NonNullable<Json>,"entity": string,"entity_id": string | null,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity": string,"entity_id"?: string | null,"id"?: never
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity"?: string,"entity_id"?: string | null,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_assignments": {
                  Row: {
                    "created_at": string,"event_id": string,"function_id": number,"id": string,"notes": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"function_id": number,"id"?: string,"notes"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"function_id"?: number,"id"?: string,"notes"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_assignments_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_assignments_function_id_fkey"
      columns: ["function_id"]
isOneToOne: false
      referencedRelation: "ministry_functions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_assignments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_songs": {
                  Row: {
                    "event_id": string,"id": string,"key_for_event": string | null,"notes": string | null,"position": number,"song_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"id"?: string,"key_for_event"?: string | null,"notes"?: string | null,"position"?: number,"song_id": string
                  }
                  Update: {
                    "event_id"?: string,"id"?: string,"key_for_event"?: string | null,"notes"?: string | null,"position"?: number,"song_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_songs_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_songs_song_id_fkey"
      columns: ["song_id"]
isOneToOne: false
      referencedRelation: "songs"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "created_at": string,"created_by": string | null,"ends_at": string | null,"id": string,"location": string | null,"notes": string | null,"starts_at": string,"status": string,"title": string,"type": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"id"?: string,"location"?: string | null,"notes"?: string | null,"starts_at": string,"status"?: string,"title": string,"type": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"id"?: string,"location"?: string | null,"notes"?: string | null,"starts_at"?: string,"status"?: string,"title"?: string,"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"media_files": {
                  Row: {
                    "created_at": string,"created_by": string | null,"duration_seconds": number | null,"event_id": string | null,"id": string,"kind": string,"label": string | null,"mime_type": string,"size_bytes": number,"song_id": string | null,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"duration_seconds"?: number | null,"event_id"?: string | null,"id"?: string,"kind": string,"label"?: string | null,"mime_type": string,"size_bytes": number,"song_id"?: string | null,"storage_path": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"duration_seconds"?: number | null,"event_id"?: string | null,"id"?: string,"kind"?: string,"label"?: string | null,"mime_type"?: string,"size_bytes"?: number,"song_id"?: string | null,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_files_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_files_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_files_song_id_fkey"
      columns: ["song_id"]
isOneToOne: false
      referencedRelation: "songs"
      referencedColumns: ["id"]
    }
                  ]
                },"member_functions": {
                  Row: {
                    "function_id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "function_id": number,"user_id": string
                  }
                  Update: {
                    "function_id"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_functions_function_id_fkey"
      columns: ["function_id"]
isOneToOne: false
      referencedRelation: "ministry_functions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_functions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ministry_functions": {
                  Row: {
                    "active": boolean,"id": number,"name": string,"section": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"id"?: never,"name": string,"section": string,"sort_order"?: number
                  }
                  Update: {
                    "active"?: boolean,"id"?: never,"name"?: string,"section"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"id": string,"link": string | null,"read_at": string | null,"title": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"link"?: string | null,"read_at"?: string | null,"title": string,"type": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"link"?: string | null,"read_at"?: string | null,"title"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"permissions": {
                  Row: {
                    "description": string,"key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"key": string
                  }
                  Update: {
                    "description"?: string,"key"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "access_role": Database["public"]['Enums']["access_role"],"created_at": string,"display_name": string | null,"full_name": string,"id": string,"is_owner": boolean,"must_change_password": boolean,"phone": string | null,"status": string,"temp_password_expires_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access_role"?: Database["public"]['Enums']["access_role"],"created_at"?: string,"display_name"?: string | null,"full_name"?: string,"id": string,"is_owner"?: boolean,"must_change_password"?: boolean,"phone"?: string | null,"status"?: string,"temp_password_expires_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "access_role"?: Database["public"]['Enums']["access_role"],"created_at"?: string,"display_name"?: string | null,"full_name"?: string,"id"?: string,"is_owner"?: boolean,"must_change_password"?: boolean,"phone"?: string | null,"status"?: string,"temp_password_expires_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"role_permissions": {
                  Row: {
                    "permission_key": string,"role": Database["public"]['Enums']["access_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "permission_key": string,"role": Database["public"]['Enums']["access_role"]
                  }
                  Update: {
                    "permission_key"?: string,"role"?: Database["public"]['Enums']["access_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "role_permissions_permission_key_fkey"
      columns: ["permission_key"]
isOneToOne: false
      referencedRelation: "permissions"
      referencedColumns: ["key"]
    }
                  ]
                },"song_chords": {
                  Row: {
                    "content": string,"review_status": string,"song_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "content"?: string,"review_status"?: string,"song_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "content"?: string,"review_status"?: string,"song_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "song_chords_song_id_fkey"
      columns: ["song_id"]
isOneToOne: true
      referencedRelation: "songs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "song_chords_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"song_favorites": {
                  Row: {
                    "created_at": string,"song_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"song_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"song_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "song_favorites_song_id_fkey"
      columns: ["song_id"]
isOneToOne: false
      referencedRelation: "songs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "song_favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"song_lyrics": {
                  Row: {
                    "content": string,"song_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "content"?: string,"song_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "content"?: string,"song_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "song_lyrics_song_id_fkey"
      columns: ["song_id"]
isOneToOne: true
      referencedRelation: "songs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "song_lyrics_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"song_versions": {
                  Row: {
                    "change_type": string,"changed_at": string,"changed_by": string | null,"field": string,"id": string,"new_value": string | null,"old_value": string | null,"song_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "change_type": string,"changed_at"?: string,"changed_by"?: string | null,"field": string,"id"?: string,"new_value"?: string | null,"old_value"?: string | null,"song_id": string
                  }
                  Update: {
                    "change_type"?: string,"changed_at"?: string,"changed_by"?: string | null,"field"?: string,"id"?: string,"new_value"?: string | null,"old_value"?: string | null,"song_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "song_versions_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "song_versions_song_id_fkey"
      columns: ["song_id"]
isOneToOne: false
      referencedRelation: "songs"
      referencedColumns: ["id"]
    }
                  ]
                },"songs": {
                  Row: {
                    "archived_at": string | null,"artist": string | null,"category": string | null,"created_at": string,"created_by": string | null,"id": string,"media_url": string | null,"notes": string | null,"official_key": string | null,"original_key": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"artist"?: string | null,"category"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"media_url"?: string | null,"notes"?: string | null,"official_key"?: string | null,"original_key"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"artist"?: string | null,"category"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"media_url"?: string | null,"notes"?: string | null,"official_key"?: string | null,"original_key"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "songs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_permissions": {
                  Row: {
                    "effect": string,"permission_key": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "effect": string,"permission_key": string,"user_id": string
                  }
                  Update: {
                    "effect"?: string,"permission_key"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_permissions_permission_key_fkey"
      columns: ["permission_key"]
isOneToOne: false
      referencedRelation: "permissions"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "user_permissions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "assert_can_reset_password":
{ Args: { "p_user_id": string }; Returns: {
              "access_role": Database["public"]['Enums']["access_role"],
"created_at": string,
"display_name": string | null,
"full_name": string,
"id": string,
"is_owner": boolean,
"must_change_password": boolean,
"phone": string | null,
"status": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"announcement_audience":
{ Args: { "p_filter": Json }; Returns: string[]
                           },
"announcement_visible":
{ Args: { "p_id": string }; Returns: boolean
                           },
"audio_files_to_purge":
{ Args: { "p_days"?: number }; Returns: {
              "reason": string,"storage_path": string
            }[]
                           },
"audio_reference_count":
{ Args: { "p_song": string }; Returns: number
                           },
"audio_upload_allowed":
{ Args: { "p_name": string }; Returns: boolean
                           },
"audio_upload_block_bytes":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"audio_upload_problem":
{ Args: { "p_except_path"?: string,"p_kind": string,"p_target": string }; Returns: string
                           },
"audio_used_bytes":
{ Args: { "p_except_path"?: string }; Returns: number
                           },
"check_audio_upload":
{ Args: { "p_kind": string,"p_target": string }; Returns: undefined
                           },
"complete_password_change":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"create_event_with_team":
{ Args: { "p_assignments"?: Json,"p_ends_at": string,"p_location": string,"p_notes": string,"p_repeat_weeks"?: number,"p_starts_at": string,"p_title": string,"p_type": string }; Returns: string[]
                           },
"create_song":
{ Args: { "p_artist": string,"p_category": string,"p_chords": string,"p_lyrics": string,"p_media_url": string,"p_notes": string,"p_official_key": string,"p_original_key": string,"p_title": string }; Returns: string
                           },
"current_change_type":
{ Args: { "op": string }; Returns: string
                           },
"delete_announcement":
{ Args: { "p_id": string }; Returns: undefined
                           },
"delete_ministry_function":
{ Args: { "p_id": number }; Returns: undefined
                           },
"duplicate_event":
{ Args: { "p_event_id": string,"p_starts_at": string }; Returns: string
                           },
"finish_password_change":
{ Args: { "p_user_id": string }; Returns: undefined
                           },
"get_announcement_audience_status":
{ Args: { "p_id": string }; Returns: {
              "display_name": string,"full_name": string,"read_at": string,"user_id": string
            }[]
                           },
"get_dashboard":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_member_contacts":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"phone": string
            }[]
                           },
"get_recent_activity":
{ Args: { "p_actor"?: string,"p_limit"?: number,"p_offset"?: number,"p_song"?: string }; Returns: {
              "action": string,"actor_id": string,"actor_name": string,"change_type": string,"field": string,"kind": string,"occurred_at": string,"song_id": string,"song_title": string,"version_id": string
            }[]
                           },
"get_song_plays":
{ Args: { "p_limit"?: number,"p_song_id": string }; Returns: Json
                           },
"get_song_stats":
{ Args: Record<PropertyKey, never>; Returns: {
              "last_played_at": string,"play_count": number,"song_id": string
            }[]
                           },
"get_storage_usage":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"has_permission":
{ Args: { "p": string }; Returns: boolean
                           },
"immutable_unaccent":
{ Args: { "value": string }; Returns: string
                           },
"is_active_member":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"mark_announcement_read":
{ Args: { "p_id": string }; Returns: undefined
                           },
"mark_password_reset":
{ Args: { "p_user_id": string }; Returns: undefined
                           },
"move_ministry_function":
{ Args: { "p_delta": number,"p_id": number }; Returns: undefined
                           },
"my_permissions":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"prepare_password_reset":
{ Args: { "p_user_id": string }; Returns: {
              "display_name": string,"email": string,"full_name": string
            }[]
                           },
"preview_announcement_audience":
{ Args: { "p_filter": Json }; Returns: number
                           },
"remind_announcement":
{ Args: { "p_id": string }; Returns: number
                           },
"restore_song_version":
{ Args: { "version_id": string }; Returns: undefined
                           },
"revoke_user_sessions":
{ Args: { "p_user_id": string }; Returns: undefined
                           },
"save_announcement":
{ Args: { "p_body": string,"p_filter": Json,"p_id": string,"p_pinned_until"?: string,"p_title": string }; Returns: string
                           },
"search_songs":
{ Args: { "q": string }; Returns: {
              "archived_at": string | null,
"artist": string | null,
"category": string | null,
"created_at": string,
"created_by": string | null,
"id": string,
"media_url": string | null,
"notes": string | null,
"official_key": string | null,
"original_key": string | null,
"title": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "songs"
        isOneToOne: false
        isSetofReturn: true
      } },
"set_event_songs":
{ Args: { "p_event_id": string,"p_items": Json }; Returns: number
                           },
"setup_new_member":
{ Args: { "p_access_role": Database["public"]['Enums']["access_role"],"p_display_name": string,"p_full_name": string,"p_function_ids": (number)[],"p_user_id": string }; Returns: undefined
                           },
"update_member":
{ Args: { "p_display_name": string,"p_full_name": string,"p_function_ids": (number)[],"p_phone": string,"p_user_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "access_role": "admin"|"leader"|"member"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "access_role": ["admin", "leader", "member"]
          }
        }
} as const
