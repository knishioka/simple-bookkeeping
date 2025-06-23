import { Account, JournalEntry, JournalEntryLine, PrismaClient } from '@prisma/client';

type JournalEntryLineWithRelations = JournalEntryLine & {
  journalEntry: JournalEntry & {
    lines: (JournalEntryLine & {
      account: Account;
    })[];
  };
  account: Account;
};

const prisma = new PrismaClient();

export interface LedgerEntry {
  id: string;
  date: Date;
  entryNumber: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  balance: number;
  counterAccountName?: string;
}

export interface LedgerQuery {
  accountCode: string;
  startDate: Date;
  endDate: Date;
  organizationId: string;
}

export class LedgerService {
  /**
   * 現金出納帳を取得
   */
  async getCashBook(query: LedgerQuery): Promise<LedgerEntry[]> {
    return this.getLedgerByAccount({
      ...query,
      accountCode: '1110', // 現金勘定コード
    });
  }

  /**
   * 預金出納帳を取得
   */
  async getBankBook(query: LedgerQuery): Promise<LedgerEntry[]> {
    // 預金関連の勘定科目コード（普通預金、当座預金など）
    const bankAccountCodes = ['1120', '1130'];

    const entries: LedgerEntry[] = [];
    for (const code of bankAccountCodes) {
      const bankEntries = await this.getLedgerByAccount({
        ...query,
        accountCode: code,
      });
      entries.push(...bankEntries);
    }

    // 日付順にソート
    return entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * 売掛金台帳を取得
   */
  async getAccountsReceivable(query: LedgerQuery): Promise<LedgerEntry[]> {
    return this.getLedgerByAccount({
      ...query,
      accountCode: '1140', // 売掛金勘定コード
    });
  }

  /**
   * 買掛金台帳を取得
   */
  async getAccountsPayable(query: LedgerQuery): Promise<LedgerEntry[]> {
    return this.getLedgerByAccount({
      ...query,
      accountCode: '2110', // 買掛金勘定コード
    });
  }

  /**
   * 特定の勘定科目の補助簿を取得
   */
  private async getLedgerByAccount(query: LedgerQuery): Promise<LedgerEntry[]> {
    const { accountCode, startDate, endDate, organizationId } = query;

    // 勘定科目を取得
    const account = await prisma.account.findFirst({
      where: {
        code: accountCode,
        organizationId,
      },
    });

    if (!account) {
      throw new Error(`Account not found: ${accountCode}`);
    }

    // 該当する仕訳明細を取得
    const journalLines = await prisma.journalEntryLine.findMany({
      where: {
        accountId: account.id,
        journalEntry: {
          entryDate: {
            gte: startDate,
            lte: endDate,
          },
          organizationId,
          status: {
            in: ['APPROVED', 'LOCKED'],
          },
        },
      },
      include: {
        account: true,
        journalEntry: {
          include: {
            lines: {
              include: {
                account: true,
              },
            },
          },
        },
      },
      orderBy: {
        journalEntry: {
          entryDate: 'asc',
        },
      },
    });

    // 補助簿エントリーに変換
    let balance = 0;
    const entries: LedgerEntry[] = [];

    for (const line of journalLines) {
      const debitAmount = Number(line.debitAmount);
      const creditAmount = Number(line.creditAmount);

      // 残高を計算
      if (account.accountType === 'ASSET' || account.accountType === 'EXPENSE') {
        balance += debitAmount - creditAmount;
      } else {
        balance += creditAmount - debitAmount;
      }

      // 相手勘定を特定
      const counterAccount = this.getCounterAccount(line);

      entries.push({
        id: line.id,
        date: line.journalEntry.entryDate,
        entryNumber: line.journalEntry.entryNumber,
        description: line.description || line.journalEntry.description,
        debitAmount,
        creditAmount,
        balance,
        counterAccountName: counterAccount?.name,
      });
    }

    return entries;
  }

  /**
   * 相手勘定を特定する
   */
  private getCounterAccount(line: JournalEntryLineWithRelations): { name: string } | undefined {
    const journalEntry = line.journalEntry;
    const otherLines = journalEntry.lines.filter((l) => l.id !== line.id);

    // 単純な2行仕訳の場合
    if (otherLines.length === 1) {
      return otherLines[0].account;
    }

    // 複数行の場合は「諸口」として扱う
    if (otherLines.length > 1) {
      return { name: '諸口' };
    }

    return undefined;
  }

  /**
   * 期間の開始残高を取得
   */
  async getOpeningBalance(
    accountCode: string,
    startDate: Date,
    organizationId: string
  ): Promise<number> {
    const account = await prisma.account.findFirst({
      where: {
        code: accountCode,
        organizationId,
      },
    });

    if (!account) {
      return 0;
    }

    // 開始日より前の仕訳明細を集計
    const result = await prisma.journalEntryLine.aggregate({
      where: {
        accountId: account.id,
        journalEntry: {
          entryDate: {
            lt: startDate,
          },
          organizationId,
          status: {
            in: ['APPROVED', 'LOCKED'],
          },
        },
      },
      _sum: {
        debitAmount: true,
        creditAmount: true,
      },
    });

    const totalDebit = Number(result._sum.debitAmount || 0);
    const totalCredit = Number(result._sum.creditAmount || 0);

    // 勘定科目タイプに応じて残高を計算
    if (account.accountType === 'ASSET' || account.accountType === 'EXPENSE') {
      return totalDebit - totalCredit;
    } else {
      return totalCredit - totalDebit;
    }
  }
}

export const ledgerService = new LedgerService();
