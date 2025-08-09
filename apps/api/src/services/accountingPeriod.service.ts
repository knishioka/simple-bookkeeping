import { PrismaClient, AccountingPeriod } from '@prisma/client';
import {
  CreateAccountingPeriodDto,
  UpdateAccountingPeriodDto,
  AccountingPeriodFilter,
  AccountingPeriodSummary,
} from '@simple-bookkeeping/types';

import { BadRequestError, NotFoundError, ConflictError } from '../errors';

export class AccountingPeriodService {
  constructor(private prisma: PrismaClient) {}

  async findAll(
    organizationId: string,
    filter?: AccountingPeriodFilter
  ): Promise<AccountingPeriod[]> {
    try {
      const where: Record<string, unknown> = { organizationId };

      if (filter) {
        if (filter.isActive !== undefined) {
          where.isActive = filter.isActive;
        }
        if (filter.name) {
          where.name = { contains: filter.name, mode: 'insensitive' };
        }
        if (filter.startDate) {
          where.startDate = { gte: new Date(filter.startDate) };
        }
        if (filter.endDate) {
          where.endDate = { lte: new Date(filter.endDate) };
        }
      }

      const periods = await this.prisma.accountingPeriod.findMany({
        where,
        orderBy: { startDate: 'desc' },
      });

      return periods;
    } catch (error) {
      console.error('Failed to fetch accounting periods:', error);
      throw error;
    }
  }

  async findById(id: string, organizationId: string): Promise<AccountingPeriod> {
    try {
      const period = await this.prisma.accountingPeriod.findFirst({
        where: { id, organizationId },
      });

      if (!period) {
        throw new NotFoundError('会計期間が見つかりません');
      }

      return period;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error('Failed to fetch accounting period:', error);
      throw error;
    }
  }

  async findWithSummary(organizationId: string): Promise<AccountingPeriodSummary[]> {
    try {
      const periods = await this.prisma.accountingPeriod.findMany({
        where: { organizationId },
        include: {
          journalEntries: {
            select: {
              id: true,
              lines: {
                select: {
                  debitAmount: true,
                  creditAmount: true,
                },
              },
            },
          },
        },
        orderBy: { startDate: 'desc' },
      });

      return periods.map((period) => {
        const totalDebit = period.journalEntries.reduce(
          (sum, entry) =>
            sum + entry.lines.reduce((lineSum, line) => lineSum + line.debitAmount.toNumber(), 0),
          0
        );
        const totalCredit = period.journalEntries.reduce(
          (sum, entry) =>
            sum + entry.lines.reduce((lineSum, line) => lineSum + line.creditAmount.toNumber(), 0),
          0
        );

        return {
          id: period.id,
          name: period.name,
          startDate: period.startDate.toISOString().split('T')[0],
          endDate: period.endDate.toISOString().split('T')[0],
          isActive: period.isActive,
          journalEntryCount: period.journalEntries.length,
          totalDebit,
          totalCredit,
        };
      });
    } catch (error) {
      console.error('Failed to fetch accounting periods with summary:', error);
      throw error;
    }
  }

  async create(organizationId: string, data: CreateAccountingPeriodDto): Promise<AccountingPeriod> {
    try {
      await this.validatePeriodDates(
        organizationId,
        new Date(data.startDate),
        new Date(data.endDate)
      );

      if (data.isActive) {
        await this.deactivateAllPeriods(organizationId);
      }

      const period = await this.prisma.accountingPeriod.create({
        data: {
          name: data.name,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          isActive: data.isActive || false,
          organizationId,
        },
      });

      // Accounting period created successfully
      return period;
    } catch (error) {
      if (error instanceof BadRequestError || error instanceof ConflictError) {
        throw error;
      }
      console.error('Failed to create accounting period:', error);
      throw error;
    }
  }

  async update(
    id: string,
    organizationId: string,
    data: UpdateAccountingPeriodDto
  ): Promise<AccountingPeriod> {
    try {
      const existingPeriod = await this.findById(id, organizationId);

      const startDate = data.startDate ? new Date(data.startDate) : existingPeriod.startDate;
      const endDate = data.endDate ? new Date(data.endDate) : existingPeriod.endDate;

      if (data.startDate || data.endDate) {
        await this.validatePeriodDates(organizationId, startDate, endDate, id);
      }

      if (data.isActive === true && !existingPeriod.isActive) {
        await this.deactivateAllPeriods(organizationId);
      }

      const period = await this.prisma.accountingPeriod.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.startDate && { startDate: new Date(data.startDate) }),
          ...(data.endDate && { endDate: new Date(data.endDate) }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      // Accounting period updated successfully
      return period;
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof BadRequestError ||
        error instanceof ConflictError
      ) {
        throw error;
      }
      console.error('Failed to update accounting period:', error);
      throw error;
    }
  }

  async delete(id: string, organizationId: string): Promise<void> {
    try {
      const period = await this.findById(id, organizationId);

      if (period.isActive) {
        throw new BadRequestError('アクティブな会計期間は削除できません');
      }

      const hasJournalEntries = await this.prisma.journalEntry.count({
        where: { accountingPeriodId: id },
      });

      if (hasJournalEntries > 0) {
        throw new BadRequestError('仕訳が存在する会計期間は削除できません');
      }

      await this.prisma.accountingPeriod.delete({
        where: { id },
      });

      // Accounting period deleted successfully
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BadRequestError) {
        throw error;
      }
      console.error('Failed to delete accounting period:', error);
      throw error;
    }
  }

  async activate(id: string, organizationId: string): Promise<AccountingPeriod> {
    try {
      const period = await this.findById(id, organizationId);

      if (period.isActive) {
        return period;
      }

      await this.deactivateAllPeriods(organizationId);

      const activatedPeriod = await this.prisma.accountingPeriod.update({
        where: { id },
        data: { isActive: true },
      });

      // Accounting period activated successfully
      return activatedPeriod;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error('Failed to activate accounting period:', error);
      throw error;
    }
  }

  async getActivePeriod(organizationId: string): Promise<AccountingPeriod | null> {
    try {
      const period = await this.prisma.accountingPeriod.findFirst({
        where: { organizationId, isActive: true },
      });

      return period;
    } catch (error) {
      console.error('Failed to fetch active accounting period:', error);
      throw error;
    }
  }

  async getPeriodForDate(organizationId: string, date: Date): Promise<AccountingPeriod | null> {
    try {
      const period = await this.prisma.accountingPeriod.findFirst({
        where: {
          organizationId,
          startDate: { lte: date },
          endDate: { gte: date },
        },
      });

      return period;
    } catch (error) {
      console.error('Failed to fetch accounting period for date:', error);
      throw error;
    }
  }

  private async validatePeriodDates(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    excludeId?: string
  ): Promise<void> {
    if (startDate >= endDate) {
      throw new BadRequestError('開始日は終了日より前である必要があります');
    }

    const overlappingPeriod = await this.prisma.accountingPeriod.findFirst({
      where: {
        organizationId,
        ...(excludeId && { NOT: { id: excludeId } }),
        OR: [
          {
            AND: [{ startDate: { lte: startDate } }, { endDate: { gte: startDate } }],
          },
          {
            AND: [{ startDate: { lte: endDate } }, { endDate: { gte: endDate } }],
          },
          {
            AND: [{ startDate: { gte: startDate } }, { endDate: { lte: endDate } }],
          },
        ],
      },
    });

    if (overlappingPeriod) {
      throw new ConflictError(
        `期間が重複しています: ${overlappingPeriod.name} (${overlappingPeriod.startDate.toISOString().split('T')[0]} - ${overlappingPeriod.endDate.toISOString().split('T')[0]})`
      );
    }
  }

  private async deactivateAllPeriods(organizationId: string): Promise<void> {
    await this.prisma.accountingPeriod.updateMany({
      where: { organizationId, isActive: true },
      data: { isActive: false },
    });
  }
}
