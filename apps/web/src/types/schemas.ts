import { z } from 'zod';

import { AccountType } from './account';

export const createAccountSchema = z.object({
  code: z
    .string()
    .min(1, '勘定科目コードを入力してください')
    .max(10, '勘定科目コードは10文字以内で入力してください'),
  name: z
    .string()
    .min(1, '勘定科目名を入力してください')
    .max(100, '勘定科目名は100文字以内で入力してください'),
  accountType: z.enum([
    AccountType.ASSET,
    AccountType.LIABILITY,
    AccountType.EQUITY,
    AccountType.REVENUE,
    AccountType.EXPENSE,
  ]),
  parentId: z.string().uuid().optional().nullable(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
