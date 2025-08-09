import { PrismaClient } from '@prisma/client';

import { BadRequestError, NotFoundError, ConflictError } from '../../errors';
import { AccountingPeriodService } from '../accountingPeriod.service';

describe('AccountingPeriodService', () => {
  let prisma: PrismaClient;
  let service: AccountingPeriodService;
  const organizationId = 'org-123';

  beforeEach(() => {
    prisma = new PrismaClient();
    service = new AccountingPeriodService(prisma);
    jest.clearAllMocks();

    // Setup default mocks for Prisma methods
    prisma.accountingPeriod.updateMany = jest.fn();
    prisma.accountingPeriod.update = jest.fn();
  });

  describe('findAll', () => {
    it('should return all accounting periods for organization', async () => {
      const mockPeriods = [
        {
          id: 'period-1',
          name: '2024年度',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          isActive: true,
          organizationId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.accountingPeriod.findMany = jest.fn().mockResolvedValue(mockPeriods);

      const result = await service.findAll(organizationId);

      expect(result).toEqual(mockPeriods);
      expect(prisma.accountingPeriod.findMany).toHaveBeenCalledWith({
        where: { organizationId },
        orderBy: { startDate: 'desc' },
      });
    });

    it('should filter by isActive', async () => {
      const mockPeriods = [
        {
          id: 'period-1',
          name: '2024年度',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          isActive: true,
          organizationId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.accountingPeriod.findMany = jest.fn().mockResolvedValue(mockPeriods);

      const result = await service.findAll(organizationId, { isActive: true });

      expect(result).toEqual(mockPeriods);
      expect(prisma.accountingPeriod.findMany).toHaveBeenCalledWith({
        where: { organizationId, isActive: true },
        orderBy: { startDate: 'desc' },
      });
    });
  });

  describe('findById', () => {
    it('should return accounting period by id', async () => {
      const mockPeriod = {
        id: 'period-1',
        name: '2024年度',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        isActive: true,
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.accountingPeriod.findFirst = jest.fn().mockResolvedValue(mockPeriod);

      const result = await service.findById('period-1', organizationId);

      expect(result).toEqual(mockPeriod);
      expect(prisma.accountingPeriod.findFirst).toHaveBeenCalledWith({
        where: { id: 'period-1', organizationId },
      });
    });

    it('should throw NotFoundError if period not found', async () => {
      prisma.accountingPeriod.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.findById('non-existent', organizationId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    it('should create new accounting period', async () => {
      const createData = {
        name: '2024年度',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        isActive: false,
      };

      const mockPeriod = {
        id: 'period-1',
        ...createData,
        startDate: new Date(createData.startDate),
        endDate: new Date(createData.endDate),
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.accountingPeriod.findFirst = jest.fn().mockResolvedValue(null);
      prisma.accountingPeriod.create = jest.fn().mockResolvedValue(mockPeriod);

      const result = await service.create(organizationId, createData);

      expect(result).toEqual(mockPeriod);
      expect(prisma.accountingPeriod.create).toHaveBeenCalledWith({
        data: {
          name: createData.name,
          startDate: new Date(createData.startDate),
          endDate: new Date(createData.endDate),
          isActive: false,
          organizationId,
        },
      });
    });

    it('should deactivate other periods when creating active period', async () => {
      const createData = {
        name: '2024年度',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        isActive: true,
      };

      prisma.accountingPeriod.findFirst = jest.fn().mockResolvedValue(null);
      prisma.accountingPeriod.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      prisma.accountingPeriod.create = jest.fn().mockResolvedValue({
        id: 'period-1',
        ...createData,
        startDate: new Date(createData.startDate),
        endDate: new Date(createData.endDate),
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.create(organizationId, createData);

      expect(prisma.accountingPeriod.updateMany).toHaveBeenCalledWith({
        where: { organizationId, isActive: true },
        data: { isActive: false },
      });
    });

    it('should throw ConflictError for overlapping periods', async () => {
      const createData = {
        name: '2024年度',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        isActive: false,
      };

      const existingPeriod = {
        id: 'existing-period',
        name: '既存期間',
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-30'),
        isActive: false,
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.accountingPeriod.findFirst = jest.fn().mockResolvedValue(existingPeriod);

      await expect(service.create(organizationId, createData)).rejects.toThrow(ConflictError);
    });
  });

  describe('delete', () => {
    it('should delete accounting period', async () => {
      const mockPeriod = {
        id: 'period-1',
        name: '2024年度',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        isActive: false,
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.accountingPeriod.findFirst = jest.fn().mockResolvedValue(mockPeriod);
      prisma.journalEntry.count = jest.fn().mockResolvedValue(0);
      prisma.accountingPeriod.delete = jest.fn().mockResolvedValue(mockPeriod);

      await service.delete('period-1', organizationId);

      expect(prisma.accountingPeriod.delete).toHaveBeenCalledWith({
        where: { id: 'period-1' },
      });
    });

    it('should not delete active period', async () => {
      const mockPeriod = {
        id: 'period-1',
        name: '2024年度',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        isActive: true,
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.accountingPeriod.findFirst = jest.fn().mockResolvedValue(mockPeriod);

      await expect(service.delete('period-1', organizationId)).rejects.toThrow(BadRequestError);
    });

    it('should not delete period with journal entries', async () => {
      const mockPeriod = {
        id: 'period-1',
        name: '2024年度',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        isActive: false,
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.accountingPeriod.findFirst = jest.fn().mockResolvedValue(mockPeriod);
      prisma.journalEntry.count = jest.fn().mockResolvedValue(5);

      await expect(service.delete('period-1', organizationId)).rejects.toThrow(BadRequestError);
    });
  });

  describe('activate', () => {
    it('should activate accounting period', async () => {
      const mockPeriod = {
        id: 'period-1',
        name: '2024年度',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        isActive: false,
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const activatedPeriod = { ...mockPeriod, isActive: true };

      prisma.accountingPeriod.findFirst = jest.fn().mockResolvedValue(mockPeriod);
      prisma.accountingPeriod.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      prisma.accountingPeriod.update = jest.fn().mockResolvedValue(activatedPeriod);

      const result = await service.activate('period-1', organizationId);

      expect(result).toEqual(activatedPeriod);
      expect(prisma.accountingPeriod.updateMany).toHaveBeenCalledWith({
        where: { organizationId, isActive: true },
        data: { isActive: false },
      });
      expect(prisma.accountingPeriod.update).toHaveBeenCalledWith({
        where: { id: 'period-1' },
        data: { isActive: true },
      });
    });

    it('should return already active period without changes', async () => {
      const mockPeriod = {
        id: 'period-1',
        name: '2024年度',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        isActive: true,
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.accountingPeriod.findFirst = jest.fn().mockResolvedValue(mockPeriod);

      const result = await service.activate('period-1', organizationId);

      expect(result).toEqual(mockPeriod);
      expect(prisma.accountingPeriod.updateMany).not.toHaveBeenCalled();
      expect(prisma.accountingPeriod.update).not.toHaveBeenCalled();
    });
  });
});
