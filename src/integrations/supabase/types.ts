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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          correction_type: string | null
          created_at: string
          details: Json | null
          expense_id: string | null
          id: string
          is_correction_log: boolean | null
          new_values: Json | null
          old_values: Json | null
          performed_by: string
        }
        Insert: {
          action: string
          correction_type?: string | null
          created_at?: string
          details?: Json | null
          expense_id?: string | null
          id?: string
          is_correction_log?: boolean | null
          new_values?: Json | null
          old_values?: Json | null
          performed_by: string
        }
        Update: {
          action?: string
          correction_type?: string | null
          created_at?: string
          details?: Json | null
          expense_id?: string | null
          id?: string
          is_correction_log?: boolean | null
          new_values?: Json | null
          old_values?: Json | null
          performed_by?: string
        }
        Relationships: []
      }
      budget_items: {
        Row: {
          allocated_amount: number
          category: string
          created_at: string
          created_by: string
          description: string | null
          fiscal_year: number
          id: string
        }
        Insert: {
          allocated_amount: number
          category: string
          created_at?: string
          created_by: string
          description?: string | null
          fiscal_year: number
          id?: string
        }
        Update: {
          allocated_amount?: number
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          fiscal_year?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_master: {
        Row: {
          annual_budget: number
          category: string
          committee: string
          created_at: string
          created_by: string
          fiscal_year: string
          id: string
          item_name: string
          monthly_budget: number
          serial_no: number
          updated_at: string
        }
        Insert: {
          annual_budget: number
          category: string
          committee: string
          created_at?: string
          created_by: string
          fiscal_year?: string
          id?: string
          item_name: string
          monthly_budget?: number
          serial_no: number
          updated_at?: string
        }
        Update: {
          annual_budget?: number
          category?: string
          committee?: string
          created_at?: string
          created_by?: string
          fiscal_year?: string
          id?: string
          item_name?: string
          monthly_budget?: number
          serial_no?: number
          updated_at?: string
        }
        Relationships: []
      }
      cam_monthly_reports: {
        Row: {
          created_at: string
          file_url: string
          id: string
          month: number
          report_type: string
          tower: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string
          year: number
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          month: number
          report_type: string
          tower: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by: string
          year: number
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          month?: number
          report_type?: string
          tower?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
          year?: number
        }
        Relationships: []
      }
      cam_tracking: {
        Row: {
          advance_payments: number
          approved_at: string | null
          approved_by: string | null
          correction_approved_at: string | null
          correction_reason: string | null
          correction_requested_at: string | null
          created_at: string
          document_url: string | null
          dues_cleared_from_previous: number
          id: string
          is_locked: boolean
          month: number | null
          notes: string | null
          paid_flats: number
          pending_flats: number
          quarter: number
          status: string
          submitted_at: string | null
          total_flats: number
          tower: string
          updated_at: string
          uploaded_by: string
          year: number
        }
        Insert: {
          advance_payments?: number
          approved_at?: string | null
          approved_by?: string | null
          correction_approved_at?: string | null
          correction_reason?: string | null
          correction_requested_at?: string | null
          created_at?: string
          document_url?: string | null
          dues_cleared_from_previous?: number
          id?: string
          is_locked?: boolean
          month?: number | null
          notes?: string | null
          paid_flats?: number
          pending_flats?: number
          quarter: number
          status?: string
          submitted_at?: string | null
          total_flats?: number
          tower: string
          updated_at?: string
          uploaded_by: string
          year: number
        }
        Update: {
          advance_payments?: number
          approved_at?: string | null
          approved_by?: string | null
          correction_approved_at?: string | null
          correction_reason?: string | null
          correction_requested_at?: string | null
          created_at?: string
          document_url?: string | null
          dues_cleared_from_previous?: number
          id?: string
          is_locked?: boolean
          month?: number | null
          notes?: string | null
          paid_flats?: number
          pending_flats?: number
          quarter?: number
          status?: string
          submitted_at?: string | null
          total_flats?: number
          tower?: string
          updated_at?: string
          uploaded_by?: string
          year?: number
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          approved_by: string | null
          budget_item_id: string | null
          budget_master_id: string | null
          claimed_by: string
          correction_approved_at: string | null
          correction_completed_at: string | null
          correction_reason: string | null
          correction_requested_at: string | null
          created_at: string
          description: string
          expense_date: string
          gst_amount: number
          id: string
          invoice_url: string | null
          is_correction: boolean | null
          status: string
          tds_amount: number | null
          tds_percentage: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          budget_item_id?: string | null
          budget_master_id?: string | null
          claimed_by: string
          correction_approved_at?: string | null
          correction_completed_at?: string | null
          correction_reason?: string | null
          correction_requested_at?: string | null
          created_at?: string
          description: string
          expense_date: string
          gst_amount?: number
          id?: string
          invoice_url?: string | null
          is_correction?: boolean | null
          status?: string
          tds_amount?: number | null
          tds_percentage?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          budget_item_id?: string | null
          budget_master_id?: string | null
          claimed_by?: string
          correction_approved_at?: string | null
          correction_completed_at?: string | null
          correction_reason?: string | null
          correction_requested_at?: string | null
          created_at?: string
          description?: string
          expense_date?: string
          gst_amount?: number
          id?: string
          invoice_url?: string | null
          is_correction?: boolean | null
          status?: string
          tds_amount?: number | null
          tds_percentage?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_budget_item_id_fkey"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_budget_master_id_fkey"
            columns: ["budget_master_id"]
            isOneToOne: false
            referencedRelation: "budget_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      historical_spending: {
        Row: {
          budget_item_id: string
          created_at: string
          created_by: string
          fiscal_year: number
          id: string
          q1_amount: number | null
          q2_amount: number | null
          q3_amount: number | null
          q4_amount: number | null
          updated_at: string
        }
        Insert: {
          budget_item_id: string
          created_at?: string
          created_by: string
          fiscal_year: number
          id?: string
          q1_amount?: number | null
          q2_amount?: number | null
          q3_amount?: number | null
          q4_amount?: number | null
          updated_at?: string
        }
        Update: {
          budget_item_id?: string
          created_at?: string
          created_by?: string
          fiscal_year?: number
          id?: string
          q1_amount?: number | null
          q2_amount?: number | null
          q3_amount?: number | null
          q4_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "historical_spending_budget_item_id_fkey"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historical_spending_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      income_actuals: {
        Row: {
          actual_amount: number
          approved_at: string | null
          approved_by: string | null
          category_id: string
          created_at: string
          fiscal_year: string
          gst_amount: number
          id: string
          month: number
          notes: string | null
          recorded_by: string
          status: string
          updated_at: string
        }
        Insert: {
          actual_amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category_id: string
          created_at?: string
          fiscal_year: string
          gst_amount?: number
          id?: string
          month: number
          notes?: string | null
          recorded_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          actual_amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string
          created_at?: string
          fiscal_year?: string
          gst_amount?: number
          id?: string
          month?: number
          notes?: string | null
          recorded_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_actuals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "income_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      income_budget: {
        Row: {
          budgeted_amount: number
          category_id: string
          created_at: string
          created_by: string
          fiscal_year: string
          id: string
          updated_at: string
        }
        Insert: {
          budgeted_amount?: number
          category_id: string
          created_at?: string
          created_by: string
          fiscal_year: string
          id?: string
          updated_at?: string
        }
        Update: {
          budgeted_amount?: number
          category_id?: string
          created_at?: string
          created_by?: string
          fiscal_year?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_budget_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "income_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      income_categories: {
        Row: {
          category_name: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          parent_category_id: string | null
          subcategory_name: string | null
          updated_at: string
        }
        Insert: {
          category_name: string
          created_at?: string
          display_order: number
          id?: string
          is_active?: boolean
          parent_category_id?: string | null
          subcategory_name?: string | null
          updated_at?: string
        }
        Update: {
          category_name?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          parent_category_id?: string | null
          subcategory_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "income_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_users: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          contact_number: string
          created_at: string
          email: string
          id: string
          interest_groups: string[]
          login_username: string | null
          name: string
          password_hash: string | null
          photo_url: string
          rejection_reason: string | null
          status: string
          temp_password: string | null
          tower_no: string
          unit_no: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          contact_number: string
          created_at?: string
          email: string
          id?: string
          interest_groups?: string[]
          login_username?: string | null
          name: string
          password_hash?: string | null
          photo_url: string
          rejection_reason?: string | null
          status?: string
          temp_password?: string | null
          tower_no: string
          unit_no: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          contact_number?: string
          created_at?: string
          email?: string
          id?: string
          interest_groups?: string[]
          login_username?: string | null
          name?: string
          password_hash?: string | null
          photo_url?: string
          rejection_reason?: string | null
          status?: string
          temp_password?: string | null
          tower_no?: string
          unit_no?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_read: boolean
          message: string
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_read?: boolean
          message: string
          related_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_read?: boolean
          message?: string
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      petty_cash: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          bill_url: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          item_name: string
          status: string
          submitted_by: string
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          bill_url?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          item_name: string
          status?: string
          submitted_by: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          bill_url?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          item_name?: string
          status?: string
          submitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "petty_cash_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      savings_master: {
        Row: {
          account_number: string | null
          approved_at: string | null
          approved_by: string | null
          bank_institution: string
          correction_reason: string | null
          created_at: string
          created_by: string
          current_status: string
          current_value: number
          document_url: string | null
          duration_months: number | null
          expected_maturity_amount: number | null
          fiscal_year: string
          id: string
          interest_rate: number | null
          investment_name: string
          investment_type: string
          maturity_date: string | null
          notes: string | null
          principal_amount: number
          start_date: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bank_institution: string
          correction_reason?: string | null
          created_at?: string
          created_by: string
          current_status?: string
          current_value?: number
          document_url?: string | null
          duration_months?: number | null
          expected_maturity_amount?: number | null
          fiscal_year: string
          id?: string
          interest_rate?: number | null
          investment_name: string
          investment_type: string
          maturity_date?: string | null
          notes?: string | null
          principal_amount?: number
          start_date: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bank_institution?: string
          correction_reason?: string | null
          created_at?: string
          created_by?: string
          current_status?: string
          current_value?: number
          document_url?: string | null
          duration_months?: number | null
          expected_maturity_amount?: number | null
          fiscal_year?: string
          id?: string
          interest_rate?: number | null
          investment_name?: string
          investment_type?: string
          maturity_date?: string | null
          notes?: string | null
          principal_amount?: number
          start_date?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      savings_tracking: {
        Row: {
          action_type: string
          amount: number | null
          approved_at: string | null
          approved_by: string | null
          correction_reason: string | null
          created_at: string
          document_url: string | null
          fiscal_year: string
          id: string
          month: number
          new_interest_rate: number | null
          new_maturity_date: string | null
          new_status: string | null
          notes: string | null
          previous_status: string | null
          savings_id: string
          status: string
          submitted_at: string | null
          submitted_by: string
          tracking_date: string
          updated_at: string
          value_after_action: number
        }
        Insert: {
          action_type: string
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          correction_reason?: string | null
          created_at?: string
          document_url?: string | null
          fiscal_year: string
          id?: string
          month: number
          new_interest_rate?: number | null
          new_maturity_date?: string | null
          new_status?: string | null
          notes?: string | null
          previous_status?: string | null
          savings_id: string
          status?: string
          submitted_at?: string | null
          submitted_by: string
          tracking_date: string
          updated_at?: string
          value_after_action: number
        }
        Update: {
          action_type?: string
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          correction_reason?: string | null
          created_at?: string
          document_url?: string | null
          fiscal_year?: string
          id?: string
          month?: number
          new_interest_rate?: number | null
          new_maturity_date?: string | null
          new_status?: string | null
          notes?: string | null
          previous_status?: string | null
          savings_id?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string
          tracking_date?: string
          updated_at?: string
          value_after_action?: number
        }
        Relationships: [
          {
            foreignKeyName: "savings_tracking_savings_id_fkey"
            columns: ["savings_id"]
            isOneToOne: false
            referencedRelation: "savings_master"
            referencedColumns: ["id"]
          },
        ]
      }
      sports_income: {
        Row: {
          amount_received: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          fiscal_year: string
          gst_amount: number
          id: string
          month: number
          notes: string | null
          sport_id: string
          status: string
          submitted_by: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_received?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          fiscal_year: string
          gst_amount?: number
          id?: string
          month: number
          notes?: string | null
          sport_id: string
          status?: string
          submitted_by: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          amount_received?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          fiscal_year?: string
          gst_amount?: number
          id?: string
          month?: number
          notes?: string | null
          sport_id?: string
          status?: string
          submitted_by?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sports_income_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports_master"
            referencedColumns: ["id"]
          },
        ]
      }
      sports_master: {
        Row: {
          agreement_url: string | null
          base_fare: number
          coach_trainer_academy: string
          created_at: string
          created_by: string
          duration: string
          gst_amount: number
          id: string
          is_active: boolean
          location: string
          num_students: number
          sport_name: string
          total_amount: number
          training_days: string[]
          updated_at: string
        }
        Insert: {
          agreement_url?: string | null
          base_fare?: number
          coach_trainer_academy: string
          created_at?: string
          created_by: string
          duration: string
          gst_amount?: number
          id?: string
          is_active?: boolean
          location: string
          num_students?: number
          sport_name: string
          total_amount?: number
          training_days?: string[]
          updated_at?: string
        }
        Update: {
          agreement_url?: string | null
          base_fare?: number
          coach_trainer_academy?: string
          created_at?: string
          created_by?: string
          duration?: string
          gst_amount?: number
          id?: string
          is_active?: boolean
          location?: string
          num_students?: number
          sport_name?: string
          total_amount?: number
          training_days?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      update_mc_password: {
        Args: {
          p_new_password: string
          p_old_password: string
          p_username: string
        }
        Returns: boolean
      }
      verify_mc_login: {
        Args: { p_password: string; p_username: string }
        Returns: {
          email: string
          id: string
          interest_groups: string[]
          login_username: string
          name: string
          needs_password_change: boolean
          photo_url: string
          status: string
          tower_no: string
          unit_no: string
        }[]
      }
    }
    Enums: {
      user_role: "treasurer" | "accountant" | "lead" | "office_assistant"
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
      user_role: ["treasurer", "accountant", "lead", "office_assistant"],
    },
  },
} as const
