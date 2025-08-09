import { z } from 'zod';

export interface AccountingPeriod {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export const createAccountingPeriodSchema = z
  .object({
    name: z
      .string()
      .min(1, '会計期間名は必須です')
      .max(100, '会計期間名は100文字以内で入力してください'),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '開始日は YYYY-MM-DD 形式で入力してください'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '終了日は YYYY-MM-DD 形式で入力してください'),
    isActive: z.boolean().optional().default(false),
  })
  .refine((data) => new Date(data.startDate) < new Date(data.endDate), {
    message: '開始日は終了日より前である必要があります',
    path: ['endDate'],
  });

export const updateAccountingPeriodSchema = z
  .object({
    name: z
      .string()
      .min(1, '会計期間名は必須です')
      .max(100, '会計期間名は100文字以内で入力してください')
      .optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '開始日は YYYY-MM-DD 形式で入力してください')
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '終了日は YYYY-MM-DD 形式で入力してください')
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) < new Date(data.endDate);
      }
      return true;
    },
    {
      message: '開始日は終了日より前である必要があります',
      path: ['endDate'],
    }
  );

export type CreateAccountingPeriodDto = z.infer<typeof createAccountingPeriodSchema>;
export type UpdateAccountingPeriodDto = z.infer<typeof updateAccountingPeriodSchema>;

export interface AccountingPeriodFilter {
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
  name?: string;
}

export interface AccountingPeriodWithOrganization extends AccountingPeriod {
  organization: {
    id: string;
    name: string;
  };
}

export interface ActivateAccountingPeriodDto {
  periodId: string;
}

export interface AccountingPeriodSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  journalEntryCount?: number;
  totalDebit?: number;
  totalCredit?: number;
}
