export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bingos: {
        Row: {
          card_id: string
          completed_at: string
          id: string
          line_index: number
          line_type: Database["public"]["Enums"]["bingo_line_type"]
          player_id: string
          triggering_claim_id: string
        }
        Insert: {
          card_id: string
          completed_at?: string
          id?: string
          line_index: number
          line_type: Database["public"]["Enums"]["bingo_line_type"]
          player_id: string
          triggering_claim_id: string
        }
        Update: {
          card_id?: string
          completed_at?: string
          id?: string
          line_index?: number
          line_type?: Database["public"]["Enums"]["bingo_line_type"]
          player_id?: string
          triggering_claim_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bingos_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bingos_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bingos_triggering_claim_id_fkey"
            columns: ["triggering_claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      card_squares: {
        Row: {
          card_id: string
          position: number
          trait_template_id: string | null
        }
        Insert: {
          card_id: string
          position: number
          trait_template_id?: string | null
        }
        Update: {
          card_id?: string
          position?: number
          trait_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_squares_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_squares_trait_template_id_fkey"
            columns: ["trait_template_id"]
            isOneToOne: false
            referencedRelation: "trait_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          generated_at: string
          id: string
          player_id: string
        }
        Insert: {
          generated_at?: string
          id?: string
          player_id: string
        }
        Update: {
          generated_at?: string
          id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          card_id: string
          claimed_at: string
          conversation_prompt: string | null
          id: string
          idempotency_key: string
          position: number
          trait_template_id: string
          via_player_id: string
        }
        Insert: {
          card_id: string
          claimed_at?: string
          conversation_prompt?: string | null
          id?: string
          idempotency_key: string
          position: number
          trait_template_id: string
          via_player_id: string
        }
        Update: {
          card_id?: string
          claimed_at?: string
          conversation_prompt?: string | null
          id?: string
          idempotency_key?: string
          position?: number
          trait_template_id?: string
          via_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_trait_template_id_fkey"
            columns: ["trait_template_id"]
            isOneToOne: false
            referencedRelation: "trait_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_via_player_id_fkey"
            columns: ["via_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          code: string
          created_at: string
          curation_locked_at: string | null
          ended_at: string | null
          facilitator_id: string
          id: string
          name: string
          reuse_unlocked: boolean
          reuse_unlocked_at: string | null
          started_at: string | null
          starts_at: string | null
          state: Database["public"]["Enums"]["event_state"]
          survey_closed_at: string | null
          survey_opened_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          curation_locked_at?: string | null
          ended_at?: string | null
          facilitator_id: string
          id?: string
          name: string
          reuse_unlocked?: boolean
          reuse_unlocked_at?: string | null
          started_at?: string | null
          starts_at?: string | null
          state?: Database["public"]["Enums"]["event_state"]
          survey_closed_at?: string | null
          survey_opened_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          curation_locked_at?: string | null
          ended_at?: string | null
          facilitator_id?: string
          id?: string
          name?: string
          reuse_unlocked?: boolean
          reuse_unlocked_at?: string | null
          started_at?: string | null
          starts_at?: string | null
          state?: Database["public"]["Enums"]["event_state"]
          survey_closed_at?: string | null
          survey_opened_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_facilitator_id_fkey"
            columns: ["facilitator_id"]
            isOneToOne: false
            referencedRelation: "facilitators"
            referencedColumns: ["id"]
          },
        ]
      }
      facilitators: {
        Row: {
          created_at: string
          email: string
          id: string
          password_hash: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          password_hash: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          password_hash?: string
        }
        Relationships: []
      }
      player_traits: {
        Row: {
          player_id: string
          trait_template_id: string
        }
        Insert: {
          player_id: string
          trait_template_id: string
        }
        Update: {
          player_id?: string
          trait_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_traits_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_traits_trait_template_id_fkey"
            columns: ["trait_template_id"]
            isOneToOne: false
            referencedRelation: "trait_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          absent: boolean
          access_code: string
          contact_handle: string | null
          created_at: string
          display_name: string
          event_id: string
          id: string
          qr_nonce: string
          survey_submitted_at: string | null
        }
        Insert: {
          absent?: boolean
          access_code: string
          contact_handle?: string | null
          created_at?: string
          display_name: string
          event_id: string
          id?: string
          qr_nonce: string
          survey_submitted_at?: string | null
        }
        Update: {
          absent?: boolean
          access_code?: string
          contact_handle?: string | null
          created_at?: string
          display_name?: string
          event_id?: string
          id?: string
          qr_nonce?: string
          survey_submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_awards: {
        Row: {
          awarded_at: string
          detail: Json | null
          event_id: string
          id: string
          player_id: string
          prize: Database["public"]["Enums"]["prize_kind"]
        }
        Insert: {
          awarded_at?: string
          detail?: Json | null
          event_id: string
          id?: string
          player_id: string
          prize: Database["public"]["Enums"]["prize_kind"]
        }
        Update: {
          awarded_at?: string
          detail?: Json | null
          event_id?: string
          id?: string
          player_id?: string
          prize?: Database["public"]["Enums"]["prize_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "prize_awards_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prize_awards_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_questions: {
        Row: {
          created_at: string
          event_id: string
          id: string
          options: Json | null
          position: number
          prompt: string
          type: Database["public"]["Enums"]["question_type"]
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          options?: Json | null
          position: number
          prompt: string
          type: Database["public"]["Enums"]["question_type"]
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          options?: Json | null
          position?: number
          prompt?: string
          type?: Database["public"]["Enums"]["question_type"]
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          id: string
          player_id: string
          question_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          player_id: string
          question_id: string
          updated_at?: string
          value: Json
        }
        Update: {
          id?: string
          player_id?: string
          question_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      trait_templates: {
        Row: {
          conversation_prompt: string | null
          created_at: string
          enabled: boolean
          event_id: string
          id: string
          kind: Database["public"]["Enums"]["trait_kind"]
          match_rule: Json | null
          question_id: string
          square_text: string
        }
        Insert: {
          conversation_prompt?: string | null
          created_at?: string
          enabled?: boolean
          event_id: string
          id?: string
          kind: Database["public"]["Enums"]["trait_kind"]
          match_rule?: Json | null
          question_id: string
          square_text: string
        }
        Update: {
          conversation_prompt?: string | null
          created_at?: string
          enabled?: boolean
          event_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["trait_kind"]
          match_rule?: Json | null
          question_id?: string
          square_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "trait_templates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trait_templates_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      bingo_line_type: "row" | "col" | "diag"
      event_state:
        | "draft"
        | "survey_open"
        | "survey_closed"
        | "curation_locked"
        | "live"
        | "paused"
        | "ended"
      prize_kind:
        | "first_across"
        | "first_down"
        | "first_diagonal"
        | "first_blackout"
        | "fastest_bingo"
        | "most_bingos"
        | "unluckiest"
      question_type: "single" | "multi" | "binary" | "text" | "numeric_bucket"
      trait_kind: "cohort" | "discovery"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      bingo_line_type: ["row", "col", "diag"],
      event_state: [
        "draft",
        "survey_open",
        "survey_closed",
        "curation_locked",
        "live",
        "paused",
        "ended",
      ],
      prize_kind: [
        "first_across",
        "first_down",
        "first_diagonal",
        "first_blackout",
        "fastest_bingo",
        "most_bingos",
        "unluckiest",
      ],
      question_type: ["single", "multi", "binary", "text", "numeric_bucket"],
      trait_kind: ["cohort", "discovery"],
    },
  },
} as const

