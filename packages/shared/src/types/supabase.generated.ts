// DO NOT EDIT — regenerate via `supabase:generate-types` npm script
// (runs: mcp__supabase__generate_typescript_types, or `supabase gen types typescript --project-id <ref>`)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          id: string
          payload: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          id?: string
          payload?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          payload?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "auth_user_email_view"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          accepted_from_ip: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          accepted_from_ip?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          accepted_from_ip?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "auth_user_email_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "auth_user_email_view"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          granted_at: string
          granted_by: string | null
          notes: string | null
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          notes?: string | null
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          notes?: string | null
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "auth_user_email_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "auth_user_email_view"
            referencedColumns: ["id"]
          },
        ]
      }
      block_sale_stands: {
        Row: {
          applicant_email: string
          applicant_name: string
          block_sale_id: string
          city: string
          created_at: string
          decided_at: string | null
          description: string
          edit_token: string
          email_confirmed_at: string | null
          id: string
          location: unknown
          status: string
          street: string
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          applicant_email: string
          applicant_name: string
          block_sale_id: string
          city: string
          created_at?: string
          decided_at?: string | null
          description: string
          edit_token: string
          email_confirmed_at?: string | null
          id?: string
          location?: unknown
          status?: string
          street: string
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          applicant_email?: string
          applicant_name?: string
          block_sale_id?: string
          city?: string
          created_at?: string
          decided_at?: string | null
          description?: string
          edit_token?: string
          email_confirmed_at?: string | null
          id?: string
          location?: unknown
          status?: string
          street?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "block_sale_stands_block_sale_id_fkey"
            columns: ["block_sale_id"]
            isOneToOne: false
            referencedRelation: "block_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_sale_stands_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_user_email_view"
            referencedColumns: ["id"]
          },
        ]
      }
      block_sales: {
        Row: {
          center_location: unknown
          city: string
          created_at: string
          daily_close: string
          daily_open: string
          description: string | null
          end_date: string
          id: string
          is_deleted: boolean
          name: string
          organizer_id: string
          published_at: string | null
          region: string | null
          slug: string
          start_date: string
          updated_at: string
        }
        Insert: {
          center_location?: unknown
          city: string
          created_at?: string
          daily_close: string
          daily_open: string
          description?: string | null
          end_date: string
          id?: string
          is_deleted?: boolean
          name: string
          organizer_id: string
          published_at?: string | null
          region?: string | null
          slug: string
          start_date: string
          updated_at?: string
        }
        Update: {
          center_location?: unknown
          city?: string
          created_at?: string
          daily_close?: string
          daily_open?: string
          description?: string | null
          end_date?: string
          id?: string
          is_deleted?: boolean
          name?: string
          organizer_id?: string
          published_at?: string | null
          region?: string | null
          slug?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "block_sales_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booked_by: string
          booking_date: string
          cancelled_at: string | null
          captured_at: string | null
          commission_rate: number
          commission_sek: number
          created_at: string
          denied_at: string | null
          expires_at: string | null
          flea_market_id: string
          id: string
          market_table_id: string
          message: string | null
          organizer_note: string | null
          payment_status: string | null
          price_sek: number
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          booked_by: string
          booking_date: string
          cancelled_at?: string | null
          captured_at?: string | null
          commission_rate?: number
          commission_sek?: number
          created_at?: string
          denied_at?: string | null
          expires_at?: string | null
          flea_market_id: string
          id?: string
          market_table_id: string
          message?: string | null
          organizer_note?: string | null
          payment_status?: string | null
          price_sek: number
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          booked_by?: string
          booking_date?: string
          cancelled_at?: string | null
          captured_at?: string | null
          commission_rate?: number
          commission_sek?: number
          created_at?: string
          denied_at?: string | null
          expires_at?: string | null
          flea_market_id?: string
          id?: string
          market_table_id?: string
          message?: string | null
          organizer_note?: string | null
          payment_status?: string | null
          price_sek?: number
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_booked_by_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_flea_market_id_fkey"
            columns: ["flea_market_id"]
            isOneToOne: false
            referencedRelation: "flea_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_flea_market_id_fkey"
            columns: ["flea_market_id"]
            isOneToOne: false
            referencedRelation: "visible_flea_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_market_table_id_fkey"
            columns: ["market_table_id"]
            isOneToOne: false
            referencedRelation: "market_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      business_owner_tokens: {
        Row: {
          clicked_at: string | null
          clicked_from_ip: unknown
          created_at: string
          email_attempt_at: string | null
          email_attempt_count: number
          expires_at: string
          flea_market_id: string
          id: string
          invalidated_at: string | null
          last_failure_code: string | null
          priority: number
          sent_at: string | null
          sent_to_email: string | null
          should_send_email: boolean
          token_hash: string
          used_at: string | null
          verification_attempts: number
          verification_code_expires_at: string | null
          verification_code_hash: string | null
          verification_email: string | null
        }
        Insert: {
          clicked_at?: string | null
          clicked_from_ip?: unknown
          created_at?: string
          email_attempt_at?: string | null
          email_attempt_count?: number
          expires_at?: string
          flea_market_id: string
          id?: string
          invalidated_at?: string | null
          last_failure_code?: string | null
          priority?: number
          sent_at?: string | null
          sent_to_email?: string | null
          should_send_email?: boolean
          token_hash: string
          used_at?: string | null
          verification_attempts?: number
          verification_code_expires_at?: string | null
          verification_code_hash?: string | null
          verification_email?: string | null
        }
        Update: {
          clicked_at?: string | null
          clicked_from_ip?: unknown
          created_at?: string
          email_attempt_at?: string | null
          email_attempt_count?: number
          expires_at?: string
          flea_market_id?: string
          id?: string
          invalidated_at?: string | null
          last_failure_code?: string | null
          priority?: number
          sent_at?: string | null
          sent_to_email?: string | null
          should_send_email?: boolean
          token_hash?: string
          used_at?: string | null
          verification_attempts?: number
          verification_code_expires_at?: string | null
          verification_code_hash?: string | null
          verification_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_owner_tokens_flea_market_id_fkey"
            columns: ["flea_market_id"]
            isOneToOne: false
            referencedRelation: "flea_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_owner_tokens_flea_market_id_fkey"
            columns: ["flea_market_id"]
            isOneToOne: false
            referencedRelation: "visible_flea_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      flea_market_images: {
        Row: {
          created_at: string
          flea_market_id: string
          id: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          flea_market_id: string
          id?: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          flea_market_id?: string
          id?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "flea_market_images_flea_market_id_fkey"
            columns: ["flea_market_id"]
            isOneToOne: false
            referencedRelation: "flea_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flea_market_images_flea_market_id_fkey"
            columns: ["flea_market_id"]
            isOneToOne: false
            referencedRelation: "visible_flea_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      flea_market_slug_history: {
        Row: {
          flea_market_id: string
          id: string
          old_slug: string
          replaced_at: string
        }
        Insert: {
          flea_market_id: string
          id?: string
          old_slug: string
          replaced_at?: string
        }
        Update: {
          flea_market_id?: string
          id?: string
          old_slug?: string
          replaced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flea_market_slug_history_flea_market_id_fkey"
            columns: ["flea_market_id"]
            isOneToOne: false
            referencedRelation: "flea_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flea_market_slug_history_flea_market_id_fkey"
            columns: ["flea_market_id"]
            isOneToOne: false
            referencedRelation: "visible_flea_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      flea_markets: {
        Row: {
          auto_accept_bookings: boolean
          category: string | null
          city: string | null
          contact_email: string | null
          contact_facebook: string | null
          contact_instagram: string | null
          contact_phone: string | null
          contact_website: string | null
          country: string | null
          created_at: string
          description: string | null
          google_place_id: string | null
          id: string
          is_deleted: boolean
          is_permanent: boolean
          is_system_owned: boolean
          latitude: number | null
          location: unknown
          longitude: number | null
          municipality: string | null
          name: string
          organizer_id: string
          published_at: string | null
          region: string | null
          slug: string | null
          status: string
          street: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          auto_accept_bookings?: boolean
          category?: string | null
          city?: string | null
          contact_email?: string | null
          contact_facebook?: string | null
          contact_instagram?: string | null
          contact_phone?: string | null
          contact_website?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          google_place_id?: string | null
          id?: string
          is_deleted?: boolean
          is_permanent?: boolean
          is_system_owned?: boolean
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          municipality?: string | null
          name: string
          organizer_id: string
          published_at?: string | null
          region?: string | null
          slug?: string | null
          status?: string
          street?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          auto_accept_bookings?: boolean
          category?: string | null
          city?: string | null
          contact_email?: string | null
          contact_facebook?: string | null
          contact_instagram?: string | null
          contact_phone?: string | null
          contact_website?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          google_place_id?: string | null
          id?: string
          is_deleted?: boolean
          is_permanent?: boolean
          is_system_owned?: boolean
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          municipality?: string | null
          name?: string
          organizer_id?: string
          published_at?: string | null
          region?: string | null
          slug?: string | null
          status?: string
          street?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flea_markets_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      market_tables: {
        Row: {
          created_at: string
          description: string | null
          flea_market_id: string
          id: string
          is_available: boolean
          label: string
          max_per_day: number
          price_sek: number
          size_description: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          flea_market_id: string
          id?: string
          is_available?: boolean
          label: string
          max_per_day?: number
          price_sek?: number
          size_description?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          flea_market_id?: string
          id?: string
          is_available?: boolean
          label?: string
          max_per_day?: number
          price_sek?: number
          size_description?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_tables_flea_market_id_fkey"
            columns: ["flea_market_id"]
            isOneToOne: false
            referencedRelation: "flea_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_tables_flea_market_id_fkey"
            columns: ["flea_market_id"]
            isOneToOne: false
            referencedRelation: "visible_flea_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_hour_exceptions: {
        Row: {
          created_at: string
          date: string
          flea_market_id: string
          id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          date: string
          flea_market_id: string
          id?: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          flea_market_id?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opening_hour_exceptions_flea_market_id_fkey"
            columns: ["flea_market_id"]
            isOneToOne: false
            referencedRelation: "flea_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_hour_exceptions_flea_market_id_fkey"
            columns: ["flea_market_id"]
            isOneToOne: false
            referencedRelation: "visible_flea_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_hour_rules: {
        Row: {
          anchor_date: string | null
          close_time: string
          created_at: string
          day_of_week: number | null
          flea_market_id: string
          id: string
          open_time: string
          type: string
        }
        Insert: {
          anchor_date?: string | null
          close_time: string
          created_at?: string
          day_of_week?: number | null
          flea_market_id: string
          id?: string
          open_time: string
          type: string
        }
        Update: {
          anchor_date?: string | null
          close_time?: string
          created_at?: string
          day_of_week?: number | null
          flea_market_id?: string
          id?: string
          open_time?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "opening_hour_rules_flea_market_id_fkey"
            columns: ["flea_market_id"]
            isOneToOne: false
            referencedRelation: "flea_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_hour_rules_flea_market_id_fkey"
            columns: ["flea_market_id"]
            isOneToOne: false
            referencedRelation: "visible_flea_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          logo_path: string | null
          phone_number: string | null
          subscription_tier: number
          updated_at: string
          user_type: number
          website: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          logo_path?: string | null
          phone_number?: string | null
          subscription_tier?: number
          updated_at?: string
          user_type?: number
          website?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          logo_path?: string | null
          phone_number?: string | null
          subscription_tier?: number
          updated_at?: string
          user_type?: number
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "auth_user_email_view"
            referencedColumns: ["id"]
          },
        ]
      }
      route_stops: {
        Row: {
          created_at: string
          flea_market_id: string
          id: string
          route_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          flea_market_id: string
          id?: string
          route_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          flea_market_id?: string
          id?: string
          route_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_flea_market_id_fkey"
            columns: ["flea_market_id"]
            isOneToOne: false
            referencedRelation: "flea_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_flea_market_id_fkey"
            columns: ["flea_market_id"]
            isOneToOne: false
            referencedRelation: "visible_flea_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_deleted: boolean
          is_published: boolean
          name: string
          planned_date: string | null
          published_at: string | null
          start_latitude: number | null
          start_longitude: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_deleted?: boolean
          is_published?: boolean
          name: string
          planned_date?: string | null
          published_at?: string | null
          start_latitude?: number | null
          start_longitude?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_deleted?: boolean
          is_published?: boolean
          name?: string
          planned_date?: string | null
          published_at?: string | null
          start_latitude?: number | null
          start_longitude?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_accounts: {
        Row: {
          created_at: string
          id: string
          onboarding_complete: boolean
          organizer_id: string
          stripe_account_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          onboarding_complete?: boolean
          organizer_id: string
          stripe_account_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          onboarding_complete?: boolean
          organizer_id?: string
          stripe_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_accounts_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      takeover_requests: {
        Row: {
          created_at: string
          flea_market_id: string
          id: string
          note: string | null
          requester_email: string
          status: string
        }
        Insert: {
          created_at?: string
          flea_market_id: string
          id?: string
          note?: string | null
          requester_email: string
          status?: string
        }
        Update: {
          created_at?: string
          flea_market_id?: string
          id?: string
          note?: string | null
          requester_email?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "takeover_requests_flea_market_id_fkey"
            columns: ["flea_market_id"]
            isOneToOne: false
            referencedRelation: "flea_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takeover_requests_flea_market_id_fkey"
            columns: ["flea_market_id"]
            isOneToOne: false
            referencedRelation: "visible_flea_markets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      auth_user_email_view: {
        Row: {
          email: string | null
          id: string | null
        }
        Insert: {
          email?: string | null
          id?: string | null
        }
        Update: {
          email?: string | null
          id?: string | null
        }
        Relationships: []
      }
      takeover_funnel: {
        Row: {
          city: string | null
          clicked_at: string | null
          code_sent: boolean | null
          days_since_sent: number | null
          email_attempt_at: string | null
          email_attempt_count: number | null
          email_submitted: boolean | null
          expires_at: string | null
          flea_market_id: string | null
          last_failure_code: string | null
          market_name: string | null
          market_slug: string | null
          priority: number | null
          sent_at: string | null
          sent_to_email: string | null
          stage: string | null
          token_id: string | null
          verification_attempts: number | null
        }
        Relationships: [
          {
            foreignKeyName: "business_owner_tokens_flea_market_id_fkey"
            columns: ["flea_market_id"]
            isOneToOne: false
            referencedRelation: "flea_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_owner_tokens_flea_market_id_fkey"
            columns: ["flea_market_id"]
            isOneToOne: false
            referencedRelation: "visible_flea_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      visible_block_sale_stands: {
        Row: {
          applicant_email: string | null
          applicant_name: string | null
          block_sale_id: string | null
          city: string | null
          created_at: string | null
          decided_at: string | null
          description: string | null
          edit_token: string | null
          email_confirmed_at: string | null
          id: string | null
          location: unknown
          status: string | null
          street: string | null
          user_id: string | null
          zip_code: string | null
        }
        Relationships: [
          {
            foreignKeyName: "block_sale_stands_block_sale_id_fkey"
            columns: ["block_sale_id"]
            isOneToOne: false
            referencedRelation: "block_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_sale_stands_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_user_email_view"
            referencedColumns: ["id"]
          },
        ]
      }
      visible_flea_markets: {
        Row: {
          auto_accept_bookings: boolean | null
          category: string | null
          city: string | null
          contact_email: string | null
          contact_facebook: string | null
          contact_instagram: string | null
          contact_phone: string | null
          contact_website: string | null
          country: string | null
          created_at: string | null
          description: string | null
          google_place_id: string | null
          id: string | null
          is_deleted: boolean | null
          is_permanent: boolean | null
          is_system_owned: boolean | null
          latitude: number | null
          location: unknown
          longitude: number | null
          municipality: string | null
          name: string | null
          organizer_id: string | null
          published_at: string | null
          region: string | null
          slug: string | null
          status: string | null
          street: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          auto_accept_bookings?: boolean | null
          category?: string | null
          city?: string | null
          contact_email?: string | null
          contact_facebook?: string | null
          contact_instagram?: string | null
          contact_phone?: string | null
          contact_website?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          google_place_id?: string | null
          id?: string | null
          is_deleted?: boolean | null
          is_permanent?: boolean | null
          is_system_owned?: boolean | null
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          municipality?: string | null
          name?: string | null
          organizer_id?: string | null
          published_at?: string | null
          region?: string | null
          slug?: string | null
          status?: string | null
          street?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          auto_accept_bookings?: boolean | null
          category?: string | null
          city?: string | null
          contact_email?: string | null
          contact_facebook?: string | null
          contact_instagram?: string | null
          contact_phone?: string | null
          contact_website?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          google_place_id?: string | null
          id?: string | null
          is_deleted?: boolean | null
          is_permanent?: boolean | null
          is_system_owned?: boolean | null
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          municipality?: string | null
          name?: string | null
          organizer_id?: string | null
          published_at?: string | null
          region?: string | null
          slug?: string | null
          status?: string | null
          street?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flea_markets_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_admin_invite: {
        Args: {
          p_client_ip: string
          p_token_hash: string
          p_user_email: string
          p_user_id: string
        }
        Returns: string
      }
      admin_user_emails: {
        Args: { user_ids: string[] }
        Returns: {
          email: string
          id: string
        }[]
      }
      bump_takeover_attempt: {
        Args: { p_max_attempts: number; p_token_id: string }
        Returns: number
      }
      cancel_expired_bookings: { Args: never; Returns: number }
      claim_takeover_atomic: {
        Args: { p_token_hash: string; p_user_id: string }
        Returns: string
      }
      is_admin: { Args: { uid?: string }; Returns: boolean }
      is_market_visible: { Args: { flea_market_id: string }; Returns: boolean }
      markets_open_now: {
        Args: never
        Returns: {
          id: string
        }[]
      }
      nearby_flea_markets: {
        Args: { lat: number; lng: number; radius_km?: number }
        Returns: {
          city: string
          description: string
          distance_km: number
          id: string
          is_permanent: boolean
          latitude: number
          longitude: number
          name: string
          published_at: string
        }[]
      }
      popular_routes_nearby: {
        Args: { lat: number; lng: number; radius_km?: number }
        Returns: {
          created_by: string
          creator_first_name: string
          creator_last_name: string
          description: string
          id: string
          name: string
          planned_date: string
          published_at: string
          stop_count: number
        }[]
      }
      remove_via_takeover: { Args: { p_token_hash: string }; Returns: string }
      replace_opening_hours_atomic: {
        Args: { p_market_id: string; p_rules: Json }
        Returns: undefined
      }
      stamp_takeover_attempt: {
        Args: { p_failure_code: string; p_token_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
