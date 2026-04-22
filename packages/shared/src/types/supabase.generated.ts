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
      flea_markets: {
        Row: {
          auto_accept_bookings: boolean
          city: string | null
          country: string | null
          created_at: string
          description: string | null
          id: string
          is_deleted: boolean
          is_permanent: boolean
          latitude: number | null
          location: unknown
          longitude: number | null
          name: string
          organizer_id: string
          published_at: string | null
          street: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          auto_accept_bookings?: boolean
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_deleted?: boolean
          is_permanent?: boolean
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          name: string
          organizer_id: string
          published_at?: string | null
          street?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          auto_accept_bookings?: boolean
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_deleted?: boolean
          is_permanent?: boolean
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          name?: string
          organizer_id?: string
          published_at?: string | null
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
        Relationships: []
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
    }
    Views: {
      visible_flea_markets: {
        Row: {
          auto_accept_bookings: boolean | null
          city: string | null
          country: string | null
          created_at: string | null
          description: string | null
          id: string | null
          is_deleted: boolean | null
          is_permanent: boolean | null
          latitude: number | null
          location: unknown
          longitude: number | null
          name: string | null
          organizer_id: string | null
          published_at: string | null
          street: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          auto_accept_bookings?: boolean | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_deleted?: boolean | null
          is_permanent?: boolean | null
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          name?: string | null
          organizer_id?: string | null
          published_at?: string | null
          street?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          auto_accept_bookings?: boolean | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_deleted?: boolean | null
          is_permanent?: boolean | null
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          name?: string | null
          organizer_id?: string | null
          published_at?: string | null
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
      cancel_expired_bookings: { Args: never; Returns: number }
      is_market_visible: { Args: { flea_market_id: string }; Returns: boolean }
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
