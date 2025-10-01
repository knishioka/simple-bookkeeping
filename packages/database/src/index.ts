export * from '@prisma/client';
export { prisma } from './client';

// Database type for Supabase
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          email?: string;
          full_name?: string;
          avatar_url?: string;
          mfa_enabled?: boolean;
          mfa_secret?: string | null;
          mfa_backup_codes?: string[] | null;
          mfa_enrolled_at?: string | null;
          mfa_last_used_at?: string | null;
          preferences?: Record<string, unknown>;
          is_active: boolean;
          deleted_at?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['profiles']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      accounts: {
        Row: {
          id: string;
          company_id: string;
          code: string;
          name: string;
          account_type: string;
          parent_id?: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['accounts']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['accounts']['Insert']>;
      };
      company_members: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          role: string;
          joined_at: string;
          is_active: boolean;
        };
        Insert: Omit<Database['public']['Tables']['company_members']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['company_members']['Insert']>;
      };
      companies: {
        Row: {
          id: string;
          name: string;
        };
        Insert: Omit<Database['public']['Tables']['companies']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['companies']['Insert']>;
      };
      journal_entry_items: {
        Row: {
          id: string;
          account_id: string;
          fiscal_year_id: string;
          debit_amount?: number;
          credit_amount?: number;
        };
        Insert: Omit<Database['public']['Tables']['journal_entry_items']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['journal_entry_items']['Insert']>;
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
      };
    };
  };
};
