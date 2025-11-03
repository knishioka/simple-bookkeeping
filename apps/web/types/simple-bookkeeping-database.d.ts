declare module '@simple-bookkeeping/database' {
  export const UserRole: {
    readonly ADMIN: 'ADMIN';
    readonly ACCOUNTANT: 'ACCOUNTANT';
    readonly VIEWER: 'VIEWER';
  };
  export type UserRole = (typeof UserRole)[keyof typeof UserRole];

  export const AuditAction: {
    readonly CREATE: 'CREATE';
    readonly UPDATE: 'UPDATE';
    readonly DELETE: 'DELETE';
    readonly APPROVE: 'APPROVE';
  };
  export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

  export type Database = {
    public: {
      Tables: {
        profiles: {
          Row: {
            id: string;
            user_id: string;
            email?: string;
            full_name?: string;
            avatar_url?: string | null;
            mfa_enabled?: boolean;
            mfa_secret?: string | null;
            mfa_backup_codes?: string[] | null;
            mfa_enrolled_at?: string | null;
            mfa_last_used_at?: string | null;
            preferences?: Record<string, unknown> | null;
            is_active: boolean;
            deleted_at?: string | null;
            created_at: string;
            updated_at: string;
          };
          Insert: Partial<
            Omit<
              Database['public']['Tables']['profiles']['Row'],
              'id' | 'created_at' | 'updated_at'
            >
          > & {
            user_id: string;
          };
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
          Insert: Partial<
            Omit<
              Database['public']['Tables']['accounts']['Row'],
              'id' | 'created_at' | 'updated_at'
            >
          > & {
            company_id: string;
            code: string;
            name: string;
            account_type: string;
          };
          Update: Partial<Database['public']['Tables']['accounts']['Insert']>;
        };
        journal_entry_items: {
          Row: {
            id: string;
            account_id: string;
            fiscal_year_id: string;
            debit_amount: number | null;
            credit_amount: number | null;
          };
          Insert: Partial<
            Omit<Database['public']['Tables']['journal_entry_items']['Row'], 'id'>
          > & {
            account_id: string;
            fiscal_year_id: string;
          };
          Update: Partial<Database['public']['Tables']['journal_entry_items']['Insert']>;
        };
        user_organizations: {
          Row: {
            user_id: string;
            organization_id?: string | null;
            role?: string | null;
            is_default?: boolean | null;
          };
          Insert: Partial<Database['public']['Tables']['user_organizations']['Row']>;
          Update: Partial<Database['public']['Tables']['user_organizations']['Insert']>;
        };
        audit_logs: {
          Row: {
            id: string;
            user_id: string;
            action: AuditAction;
            created_at: string;
          };
          Insert: Partial<
            Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>
          > & {
            user_id: string;
            action: AuditAction;
          };
          Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
        };
        company_members: {
          Row: {
            company_id: string;
            user_id: string;
            role: string;
            joined_at: string;
            is_active: boolean;
          };
          Insert: Partial<Database['public']['Tables']['company_members']['Row']>;
          Update: Partial<Database['public']['Tables']['company_members']['Insert']>;
        };
      };
    };
  };
}
