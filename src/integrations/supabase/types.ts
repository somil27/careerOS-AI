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
      ai_analyses: {
        Row: {
          created_at: string
          id: string
          input: Json | null
          kind: string
          output: Json | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input?: Json | null
          kind: string
          output?: Json | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input?: Json | null
          kind?: string
          output?: Json | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      application_activities: {
        Row: {
          application_id: string
          created_at: string
          from_status: string | null
          id: string
          message: string | null
          meta: Json | null
          to_status: string | null
          type: string
          user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          message?: string | null
          meta?: Json | null
          to_status?: string | null
          type: string
          user_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          message?: string | null
          meta?: Json | null
          to_status?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_activities_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      application_attachments: {
        Row: {
          application_id: string
          created_at: string
          file_path: string
          id: string
          mime: string | null
          name: string
          size: number | null
          user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          file_path: string
          id?: string
          mime?: string | null
          name: string
          size?: number | null
          user_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          file_path?: string
          id?: string
          mime?: string | null
          name?: string
          size?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_attachments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          application_date: string | null
          board_order: number
          company: string
          created_at: string
          deadline: string | null
          deleted_at: string | null
          follow_up_at: string | null
          id: string
          job_url: string | null
          location: string | null
          notes: string | null
          recruiter: string | null
          referral_status: string | null
          role: string
          salary: string | null
          status: Database["public"]["Enums"]["app_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          application_date?: string | null
          board_order?: number
          company: string
          created_at?: string
          deadline?: string | null
          deleted_at?: string | null
          follow_up_at?: string | null
          id?: string
          job_url?: string | null
          location?: string | null
          notes?: string | null
          recruiter?: string | null
          referral_status?: string | null
          role: string
          salary?: string | null
          status?: Database["public"]["Enums"]["app_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          application_date?: string | null
          board_order?: number
          company?: string
          created_at?: string
          deadline?: string | null
          deleted_at?: string | null
          follow_up_at?: string | null
          id?: string
          job_url?: string | null
          location?: string | null
          notes?: string | null
          recruiter?: string | null
          referral_status?: string | null
          role?: string
          salary?: string | null
          status?: Database["public"]["Enums"]["app_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      career_goals: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          priority: string
          progress: number
          status: string
          target_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          progress?: number
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          progress?: number
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      career_profile: {
        Row: {
          context_summary: string | null
          created_at: string
          current_title: string | null
          location: string | null
          target_role: string | null
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          context_summary?: string | null
          created_at?: string
          current_title?: string | null
          location?: string | null
          target_role?: string | null
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          context_summary?: string | null
          created_at?: string
          current_title?: string | null
          location?: string | null
          target_role?: string | null
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      career_skills: {
        Row: {
          category: string | null
          created_at: string
          current_level: number
          id: string
          last_practiced_at: string | null
          name: string
          notes: string | null
          priority: string
          target_level: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          current_level?: number
          id?: string
          last_practiced_at?: string | null
          name: string
          notes?: string | null
          priority?: string
          target_level?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          current_level?: number
          id?: string
          last_practiced_at?: string | null
          name?: string
          notes?: string | null
          priority?: string
          target_level?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      interview_notes: {
        Row: {
          application_id: string | null
          company: string
          created_at: string
          feedback: string | null
          id: string
          interview_date: string | null
          learning: string | null
          mistakes: string | null
          questions: string | null
          rating: number | null
          round: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          company: string
          created_at?: string
          feedback?: string | null
          id?: string
          interview_date?: string | null
          learning?: string | null
          mistakes?: string | null
          questions?: string | null
          rating?: number | null
          round?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          company?: string
          created_at?: string
          feedback?: string | null
          id?: string
          interview_date?: string | null
          learning?: string | null
          mistakes?: string | null
          questions?: string | null
          rating?: number | null
          round?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_sessions: {
        Row: {
          analysis: Json | null
          behavioral_score: number | null
          communication_score: number | null
          company: string | null
          confidence_score: number | null
          created_at: string
          difficulty: string | null
          duration_seconds: number | null
          feedback: Json | null
          id: string
          interview_type: string
          mode: string
          overall_score: number | null
          questions: Json
          role: string | null
          status: string
          technical_score: number | null
          transcript: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json | null
          behavioral_score?: number | null
          communication_score?: number | null
          company?: string | null
          confidence_score?: number | null
          created_at?: string
          difficulty?: string | null
          duration_seconds?: number | null
          feedback?: Json | null
          id?: string
          interview_type: string
          mode?: string
          overall_score?: number | null
          questions?: Json
          role?: string | null
          status?: string
          technical_score?: number | null
          transcript?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json | null
          behavioral_score?: number | null
          communication_score?: number | null
          company?: string | null
          confidence_score?: number | null
          created_at?: string
          difficulty?: string | null
          duration_seconds?: number | null
          feedback?: Json | null
          id?: string
          interview_type?: string
          mode?: string
          overall_score?: number | null
          questions?: Json
          role?: string | null
          status?: string
          technical_score?: number | null
          transcript?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          headline: string | null
          id: string
          target_role: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          headline?: string | null
          id: string
          target_role?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          headline?: string | null
          id?: string
          target_role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          id: string
          linkedin: string | null
          notes: string | null
          referrer_name: string
          reminder_date: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          linkedin?: string | null
          notes?: string | null
          referrer_name: string
          reminder_date?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          linkedin?: string | null
          notes?: string | null
          referrer_name?: string
          reminder_date?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      resume_downloads: {
        Row: {
          created_at: string
          id: string
          resume_id: string
          source: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          resume_id: string
          source?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          resume_id?: string
          source?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resume_downloads_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      resume_shares: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          password_hash: string | null
          resume_id: string
          slug: string
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          password_hash?: string | null
          resume_id: string
          slug: string
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          password_hash?: string | null
          resume_id?: string
          slug?: string
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "resume_shares_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      resume_views: {
        Row: {
          country: string | null
          created_at: string
          id: string
          referrer: string | null
          resume_id: string
          share_id: string
          user_agent: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          referrer?: string | null
          resume_id: string
          share_id: string
          user_agent?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          referrer?: string | null
          resume_id?: string
          share_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resume_views_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resume_views_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "resume_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      resumes: {
        Row: {
          created_at: string
          deleted_at: string | null
          download_count: number
          extracted_text: string | null
          file_path: string
          file_size: number | null
          id: string
          is_active: boolean
          last_downloaded_at: string | null
          name: string
          notes: string | null
          parent_id: string | null
          tags: string[]
          template: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          download_count?: number
          extracted_text?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          is_active?: boolean
          last_downloaded_at?: string | null
          name: string
          notes?: string | null
          parent_id?: string | null
          tags?: string[]
          template?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          download_count?: number
          extracted_text?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          is_active?: boolean
          last_downloaded_at?: string | null
          name?: string
          notes?: string | null
          parent_id?: string | null
          tags?: string[]
          template?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "resumes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "resumes"
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
      app_status:
        | "applied"
        | "oa"
        | "interview"
        | "hr"
        | "offer"
        | "rejected"
        | "joined"
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
    Enums: {
      app_status: [
        "applied",
        "oa",
        "interview",
        "hr",
        "offer",
        "rejected",
        "joined",
      ],
    },
  },
} as const
