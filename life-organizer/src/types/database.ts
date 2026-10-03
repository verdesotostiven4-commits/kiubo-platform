// Tipos TypeScript que espejan el esquema de Supabase (schema.sql).
// Se usan para queries type-safe con createClient<Database>().

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          role: "estudiante" | "pareja" | "admin";
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          avatar_url?: string | null;
          role?: "estudiante" | "pareja" | "admin";
          created_at?: string;
        };
        Update: {
          display_name?: string;
          avatar_url?: string | null;
          role?: "estudiante" | "pareja" | "admin";
        };
      };

      subjects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          is_practice: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          is_practice?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          is_practice?: boolean;
          sort_order?: number;
        };
      };

      class_sessions: {
        Row: {
          id: string;
          user_id: string;
          subject_id: string;
          day_of_week: 1 | 2 | 3 | 4 | 5;
          start_time: string; // "HH:MM:SS"
          end_time: string;
          room: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject_id: string;
          day_of_week: 1 | 2 | 3 | 4 | 5;
          start_time: string;
          end_time: string;
          room?: string | null;
          created_at?: string;
        };
        Update: {
          subject_id?: string;
          day_of_week?: 1 | 2 | 3 | 4 | 5;
          start_time?: string;
          end_time?: string;
          room?: string | null;
        };
      };

      attendance: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          session_date: string; // ISO date
          status: "asisti" | "falta" | "no_hubo";
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          session_date: string;
          status: "asisti" | "falta" | "no_hubo";
          note?: string;
          created_at?: string;
        };
        Update: {
          status?: "asisti" | "falta" | "no_hubo";
          note?: string;
        };
      };

      practice_logs: {
        Row: {
          id: string;
          user_id: string;
          practice_date: string;
          description: string;
          hours: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          practice_date: string;
          description: string;
          hours?: number;
          created_at?: string;
        };
        Update: {
          description?: string;
          hours?: number;
        };
      };

      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          category: "estudio" | "personal" | "deseos";
          subject_id: string | null;
          priority: 1 | 2 | 3 | 4 | 5;
          due_date: string | null;
          completed: boolean;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          category: "estudio" | "personal" | "deseos";
          subject_id?: string | null;
          priority?: 1 | 2 | 3 | 4 | 5;
          due_date?: string | null;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string;
          category?: "estudio" | "personal" | "deseos";
          subject_id?: string | null;
          priority?: 1 | 2 | 3 | 4 | 5;
          due_date?: string | null;
          completed?: boolean;
          completed_at?: string | null;
        };
      };

      water_logs: {
        Row: {
          id: string;
          user_id: string;
          log_date: string;
          cups: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          log_date: string;
          cups?: number;
          updated_at?: string;
        };
        Update: {
          cups?: number;
          updated_at?: string;
        };
      };

      workout_logs: {
        Row: {
          id: string;
          user_id: string;
          workout_date: string;
          minutes: number;
          muscle_group:
            | "Glúteos & Piernas"
            | "Espalda & Brazos"
            | "Abdomen & Core"
            | "Cardio & Caminata"
            | "Cuerpo Completo";
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workout_date: string;
          minutes?: number;
          muscle_group:
            | "Glúteos & Piernas"
            | "Espalda & Brazos"
            | "Abdomen & Core"
            | "Cardio & Caminata"
            | "Cuerpo Completo";
          note?: string;
          created_at?: string;
        };
        Update: {
          minutes?: number;
          muscle_group?:
            | "Glúteos & Piernas"
            | "Espalda & Brazos"
            | "Abdomen & Core"
            | "Cardio & Caminata"
            | "Cuerpo Completo";
          note?: string;
        };
      };

      pantry_budgets: {
        Row: {
          id: string;
          user_id: string;
          weeks: number;
          budget: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          weeks?: number;
          budget?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          weeks?: number;
          budget?: number;
          is_active?: boolean;
        };
      };

      shopping_items: {
        Row: {
          id: string;
          user_id: string;
          budget_id: string | null;
          name: string;
          category:
            | "Frutas"
            | "Verduras"
            | "Proteína"
            | "Granos secos"
            | "Lácteos";
          checked: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          budget_id?: string | null;
          name: string;
          category:
            | "Frutas"
            | "Verduras"
            | "Proteína"
            | "Granos secos"
            | "Lácteos";
          checked?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          category?:
            | "Frutas"
            | "Verduras"
            | "Proteína"
            | "Granos secos"
            | "Lácteos";
          checked?: boolean;
        };
      };

      pantry_category_expenses: {
        Row: {
          id: string;
          user_id: string;
          budget_id: string | null;
          category:
            | "Frutas"
            | "Verduras"
            | "Proteína"
            | "Granos secos"
            | "Lácteos";
          amount: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          budget_id?: string | null;
          category:
            | "Frutas"
            | "Verduras"
            | "Proteína"
            | "Granos secos"
            | "Lácteos";
          amount?: number;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          updated_at?: string;
        };
      };

      extra_expenses: {
        Row: {
          id: string;
          user_id: string;
          budget_id: string | null;
          name: string;
          cost: number;
          expense_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          budget_id?: string | null;
          name: string;
          cost: number;
          expense_date: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          cost?: number;
          expense_date?: string;
        };
      };

      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          kind: "banco" | "efectivo" | "ahorros";
          balance: number;
          note: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          kind?: "banco" | "efectivo" | "ahorros";
          balance?: number;
          note?: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          kind?: "banco" | "efectivo" | "ahorros";
          balance?: number;
          note?: string;
          sort_order?: number;
        };
      };

      transactions: {
        Row: {
          id: string;
          user_id: string;
          type: "ingreso" | "gasto" | "retiro";
          account_id: string;
          to_account_id: string | null;
          amount: number;
          main_category:
            | "Fotografía & Video"
            | "Sistemas / Programación"
            | "Ingresos Extras"
            | null;
          sub_category: string | null;
          description: string;
          savings_pct: number;
          savings_amount: number;
          net_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: "ingreso" | "gasto" | "retiro";
          account_id: string;
          to_account_id?: string | null;
          amount: number;
          main_category?:
            | "Fotografía & Video"
            | "Sistemas / Programación"
            | "Ingresos Extras"
            | null;
          sub_category?: string | null;
          description: string;
          savings_pct?: number;
          savings_amount?: number;
          net_amount?: number;
          created_at?: string;
        };
        Update: {
          main_category?:
            | "Fotografía & Video"
            | "Sistemas / Programación"
            | "Ingresos Extras"
            | null;
          sub_category?: string | null;
          description?: string;
          savings_pct?: number;
          savings_amount?: number;
          net_amount?: number;
        };
      };

      debts: {
        Row: {
          id: string;
          user_id: string;
          person: string;
          amount: number;
          reason: string;
          direction: "debo" | "me_deben";
          status: "pendiente" | "pagado";
          settled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          person: string;
          amount: number;
          reason?: string;
          direction: "debo" | "me_deben";
          status?: "pendiente" | "pagado";
          settled_at?: string | null;
          created_at?: string;
        };
        Update: {
          person?: string;
          amount?: number;
          reason?: string;
          direction?: "debo" | "me_deben";
          status?: "pendiente" | "pagado";
          settled_at?: string | null;
        };
      };

      exam_grades: {
        Row: {
          id: string;
          user_id: string;
          subject_id: string;
          exam_name: string;
          grade: number;
          max_grade: number;
          exam_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject_id: string;
          exam_name: string;
          grade: number;
          max_grade?: number;
          exam_date: string;
          created_at?: string;
        };
        Update: {
          exam_name?: string;
          grade?: number;
          max_grade?: number;
          exam_date?: string;
        };
      };
    };

    Views: {
      attendance_aggregate: {
        Row: {
          user_id: string;
          subject_id: string;
          subject_name: string;
          attended: number;
          missed: number;
          cancelled: number;
          attendance_pct: number | null;
        };
      };
    };

    Functions: {
      seed_initial_data: {
        Args: Record<string, never>;
        Returns: void;
      };
      record_transaction: {
        Args: {
          p_type: "ingreso" | "gasto" | "retiro";
          p_account_id: string;
          p_amount: number;
          p_description: string;
          p_to_account_id?: string | null;
          p_main_category?:
            | "Fotografía & Video"
            | "Sistemas / Programación"
            | "Ingresos Extras"
            | null;
          p_sub_category?: string | null;
          p_savings_pct?: number;
        };
        Returns: string; // uuid de la transacción creada
      };
    };
  };
}
