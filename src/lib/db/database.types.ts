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
      academic_items: {
        Row: {
          created_at: string
          curriculum_subject_id: string | null
          due_at: string | null
          id: string
          kind: Database["public"]["Enums"]["academic_item_kind"]
          notes: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["academic_item_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          curriculum_subject_id?: string | null
          due_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["academic_item_kind"]
          notes?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["academic_item_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          curriculum_subject_id?: string | null
          due_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["academic_item_kind"]
          notes?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["academic_item_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_items_curriculum_subject_id_fkey"
            columns: ["curriculum_subject_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_units: {
        Row: {
          created_at: string
          id: string
          institution_id: string
          kind: Database["public"]["Enums"]["academic_unit_kind"]
          name: string
          parent_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id: string
          kind: Database["public"]["Enums"]["academic_unit_kind"]
          name: string
          parent_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string
          kind?: Database["public"]["Enums"]["academic_unit_kind"]
          name?: string
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_units_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_units_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "academic_units"
            referencedColumns: ["id"]
          },
        ]
      }
      curricula: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          program_id: string
          source_fetched_at: string | null
          source_kind: string | null
          source_url: string | null
          valid_from: string | null
          valid_to: string | null
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          program_id: string
          source_fetched_at?: string | null
          source_kind?: string | null
          source_url?: string | null
          valid_from?: string | null
          valid_to?: string | null
          version: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          program_id?: string
          source_fetched_at?: string | null
          source_kind?: string | null
          source_url?: string | null
          valid_from?: string | null
          valid_to?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "curricula_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_subjects: {
        Row: {
          created_at: string
          credits: number | null
          curriculum_id: string
          display_order: number
          elective: boolean
          id: string
          subject_id: string
          term: Database["public"]["Enums"]["academic_term"]
          year_level: number
        }
        Insert: {
          created_at?: string
          credits?: number | null
          curriculum_id: string
          display_order?: number
          elective?: boolean
          id?: string
          subject_id: string
          term: Database["public"]["Enums"]["academic_term"]
          year_level: number
        }
        Update: {
          created_at?: string
          credits?: number | null
          curriculum_id?: string
          display_order?: number
          elective?: boolean
          id?: string
          subject_id?: string
          term?: Database["public"]["Enums"]["academic_term"]
          year_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_subjects_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          country: string
          created_at: string
          id: string
          metadata: Json
          name: string
          short_name: string
          slug: string
        }
        Insert: {
          country?: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          short_name: string
          slug: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          short_name?: string
          slug?: string
        }
        Relationships: []
      }
      prerequisites: {
        Row: {
          created_at: string
          curriculum_subject_id: string
          id: string
          kind: Database["public"]["Enums"]["prerequisite_kind"]
          required_curriculum_subject_id: string
        }
        Insert: {
          created_at?: string
          curriculum_subject_id: string
          id?: string
          kind: Database["public"]["Enums"]["prerequisite_kind"]
          required_curriculum_subject_id: string
        }
        Update: {
          created_at?: string
          curriculum_subject_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["prerequisite_kind"]
          required_curriculum_subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prerequisites_curriculum_subject_id_fkey"
            columns: ["curriculum_subject_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prerequisites_required_curriculum_subject_id_fkey"
            columns: ["required_curriculum_subject_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          academic_unit_id: string
          created_at: string
          degree_type: string
          duration_hint: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          academic_unit_id: string
          created_at?: string
          degree_type?: string
          duration_hint?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          academic_unit_id?: string
          created_at?: string
          degree_type?: string
          duration_hint?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_academic_unit_id_fkey"
            columns: ["academic_unit_id"]
            isOneToOne: false
            referencedRelation: "academic_units"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          body: string | null
          created_at: string
          curriculum_subject_id: string | null
          id: string
          kind: Database["public"]["Enums"]["resource_kind"]
          storage_path: string | null
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          curriculum_subject_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["resource_kind"]
          storage_path?: string | null
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          curriculum_subject_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["resource_kind"]
          storage_path?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_curriculum_subject_id_fkey"
            columns: ["curriculum_subject_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string | null
          created_at: string
          id: string
          name: string
          normalized_name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          name: string
          normalized_name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          normalized_name?: string
        }
        Relationships: []
      }
      user_academic_contexts: {
        Row: {
          academic_unit_id: string | null
          created_at: string
          curriculum_id: string | null
          id: string
          institution_id: string | null
          is_active: boolean
          program_id: string | null
          unmapped_label: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_unit_id?: string | null
          created_at?: string
          curriculum_id?: string | null
          id?: string
          institution_id?: string | null
          is_active?: boolean
          program_id?: string | null
          unmapped_label?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_unit_id?: string | null
          created_at?: string
          curriculum_id?: string | null
          id?: string
          institution_id?: string | null
          is_active?: boolean
          program_id?: string | null
          unmapped_label?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_academic_contexts_academic_unit_id_fkey"
            columns: ["academic_unit_id"]
            isOneToOne: false
            referencedRelation: "academic_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_academic_contexts_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_academic_contexts_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_academic_contexts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subject_states: {
        Row: {
          completed_at: string | null
          created_at: string
          curriculum_subject_id: string
          grade: number | null
          id: string
          notes: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["subject_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          curriculum_subject_id: string
          grade?: number | null
          id?: string
          notes?: string | null
          started_at?: string | null
          status: Database["public"]["Enums"]["subject_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          curriculum_subject_id?: string
          grade?: number | null
          id?: string
          notes?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["subject_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subject_states_curriculum_subject_id_fkey"
            columns: ["curriculum_subject_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      normalize_academic_name: { Args: { value: string }; Returns: string }
    }
    Enums: {
      academic_item_kind:
        | "task"
        | "assignment"
        | "midterm"
        | "final"
        | "registration"
        | "class"
        | "custom"
      academic_item_status: "open" | "done" | "cancelled"
      academic_term: "anual" | "1c" | "2c"
      academic_unit_kind:
        | "faculty"
        | "regional_faculty"
        | "school"
        | "department"
        | "institute"
      prerequisite_kind: "to_take" | "to_pass" | "recommended"
      resource_kind: "link" | "note" | "file"
      subject_status:
        | "in_progress"
        | "regularized"
        | "passed"
        | "failed"
        | "equivalent"
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
      academic_item_kind: [
        "task",
        "assignment",
        "midterm",
        "final",
        "registration",
        "class",
        "custom",
      ],
      academic_item_status: ["open", "done", "cancelled"],
      academic_term: ["anual", "1c", "2c"],
      academic_unit_kind: [
        "faculty",
        "regional_faculty",
        "school",
        "department",
        "institute",
      ],
      prerequisite_kind: ["to_take", "to_pass", "recommended"],
      resource_kind: ["link", "note", "file"],
      subject_status: [
        "in_progress",
        "regularized",
        "passed",
        "failed",
        "equivalent",
      ],
    },
  },
} as const

