import { z } from 'zod';

import { AccountType } from './account';

export const createAccountSchema = z.object({
  code: z.string().min(1, '勘定科目コードは必須です'),
  name: z.string().min(1, '勘定科目名は必須です'),
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
