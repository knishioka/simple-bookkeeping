/**
 * Supabaseデータベース型定義
 *
 * 注意: この型定義は自動生成されます。
 * 実際の使用時は以下のコマンドで生成してください：
 * npx supabase gen types typescript --project-id [PROJECT_ID] > apps/web/src/lib/supabase/database.types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          code: string;
          tax_id: string | null;
          address: string | null;
          phone: string | null;
          email: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          tax_id?: string | null;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          tax_id?: string | null;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: 'admin' | 'accountant' | 'viewer';
          organization_id: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          role?: 'admin' | 'accountant' | 'viewer';
          organization_id: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: 'admin' | 'accountant' | 'viewer';
          organization_id?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_organizations: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          role: 'admin' | 'accountant' | 'viewer';
          is_default: boolean;
          joined_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id: string;
          role: 'admin' | 'accountant' | 'viewer';
          is_default?: boolean;
          joined_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          organization_id?: string;
          role?: 'admin' | 'accountant' | 'viewer';
          is_default?: boolean;
          joined_at?: string;
        };
      };
      accounts: {
        Row: {
          id: string;
          organization_id: string;
          code: string;
          name: string;
          name_kana: string | null;
          account_type: string;
          category: string;
          sub_category: string | null;
          is_active: boolean;
          description: string | null;
          tax_rate: number | null;
          parent_account_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          code: string;
          name: string;
          name_kana?: string | null;
          account_type: string;
          category: string;
          sub_category?: string | null;
          is_active?: boolean;
          description?: string | null;
          tax_rate?: number | null;
          parent_account_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          code?: string;
          name?: string;
          name_kana?: string | null;
          account_type?: string;
          category?: string;
          sub_category?: string | null;
          is_active?: boolean;
          description?: string | null;
          tax_rate?: number | null;
          parent_account_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      journal_entries: {
        Row: {
          id: string;
          organization_id: string;
          accounting_period_id: string;
          entry_number: string;
          entry_date: string;
          description: string;
          status: 'draft' | 'pending' | 'approved' | 'cancelled';
          created_by: string;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          accounting_period_id: string;
          entry_number: string;
          entry_date: string;
          description: string;
          status?: 'draft' | 'pending' | 'approved' | 'cancelled';
          created_by: string;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          accounting_period_id?: string;
          entry_number?: string;
          entry_date?: string;
          description?: string;
          status?: 'draft' | 'pending' | 'approved' | 'cancelled';
          created_by?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      journal_entry_lines: {
        Row: {
          id: string;
          journal_entry_id: string;
          account_id: string;
          partner_id: string | null;
          debit_amount: number;
          credit_amount: number;
          tax_amount: number | null;
          tax_rate: number | null;
          description: string | null;
          line_number: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          journal_entry_id: string;
          account_id: string;
          partner_id?: string | null;
          debit_amount: number;
          credit_amount: number;
          tax_amount?: number | null;
          tax_rate?: number | null;
          description?: string | null;
          line_number: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          journal_entry_id?: string;
          account_id?: string;
          partner_id?: string | null;
          debit_amount?: number;
          credit_amount?: number;
          tax_amount?: number | null;
          tax_rate?: number | null;
          description?: string | null;
          line_number?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      accounting_periods: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          start_date: string;
          end_date: string;
          is_closed: boolean;
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          start_date: string;
          end_date: string;
          is_closed?: boolean;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          start_date?: string;
          end_date?: string;
          is_closed?: boolean;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      partners: {
        Row: {
          id: string;
          organization_id: string;
          code: string;
          name: string;
          name_kana: string | null;
          partner_type: 'customer' | 'supplier' | 'both';
          tax_id: string | null;
          postal_code: string | null;
          address: string | null;
          phone: string | null;
          email: string | null;
          bank_name: string | null;
          bank_branch: string | null;
          bank_account_type: string | null;
          bank_account_number: string | null;
          bank_account_name: string | null;
          payment_terms: number | null;
          credit_limit: number | null;
          is_active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          code: string;
          name: string;
          name_kana?: string | null;
          partner_type: 'customer' | 'supplier' | 'both';
          tax_id?: string | null;
          postal_code?: string | null;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          bank_name?: string | null;
          bank_branch?: string | null;
          bank_account_type?: string | null;
          bank_account_number?: string | null;
          bank_account_name?: string | null;
          payment_terms?: number | null;
          credit_limit?: number | null;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          code?: string;
          name?: string;
          name_kana?: string | null;
          partner_type?: 'customer' | 'supplier' | 'both';
          tax_id?: string | null;
          postal_code?: string | null;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          bank_name?: string | null;
          bank_branch?: string | null;
          bank_account_type?: string | null;
          bank_account_number?: string | null;
          bank_account_name?: string | null;
          payment_terms?: number | null;
          credit_limit?: number | null;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          action: string;
          entity_type: string;
          entity_id: string;
          old_values: Json | null;
          new_values: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          action: string;
          entity_type: string;
          entity_id: string;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          action?: string;
          entity_type?: string;
          entity_id?: string;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      user_organization_ids: {
        Args: { user_id: string };
        Returns: { organization_id: string }[];
      };
      current_user_organization_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      user_role_in_organization: {
        Args: { p_organization_id: string };
        Returns: string | null;
      };
      is_admin_in_organization: {
        Args: { p_organization_id: string };
        Returns: boolean;
      };
      is_accountant_or_admin: {
        Args: { p_organization_id: string };
        Returns: boolean;
      };
      create_journal_entry: {
        Args: {
          p_organization_id: string;
          p_accounting_period_id: string;
          p_entry_date: string;
          p_description: string;
          p_lines: Json;
        };
        Returns: string;
      };
    };
    Enums: {
      user_role: 'admin' | 'accountant' | 'viewer';
      journal_entry_status: 'draft' | 'pending' | 'approved' | 'cancelled';
      partner_type: 'customer' | 'supplier' | 'both';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
