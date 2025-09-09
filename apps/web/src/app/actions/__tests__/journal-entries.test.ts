import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

import {
  getJournalEntries,
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
} from '../journal-entries';
import { ERROR_CODES } from '../types';

// Mock dependencies
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

const mockRevalidatePath = revalidatePath as jest.MockedFunction<typeof revalidatePath>;
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('Journal Entries Server Actions', () => {
  let mockSupabaseClient: any;

  // Helper function to create chainable query mocks
  const createQueryMock = (result: any) => {
    const query: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(result),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };
    // For non-single queries
    query.range = jest.fn().mockResolvedValue(result);
    return query;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock Supabase client with chainable methods
    mockSupabaseClient = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
    };

    // Mock createClient to return a Promise that resolves to the mock client
    mockCreateClient.mockImplementation(() => Promise.resolve(mockSupabaseClient));
  });

  describe('getJournalEntries', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockOrganizationId = 'org-123';

    it('should successfully fetch journal entries with default pagination', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock user organization check
      const userOrgQuery = createQueryMock({
        data: { role: 'admin' },
        error: null,
      });

      // Mock journal entries query
      const mockEntries = [
        {
          id: 'entry-1',
          entry_number: 'JE-2024-001',
          entry_date: '2024-01-01',
          description: 'Opening entry',
          status: 'approved',
        },
        {
          id: 'entry-2',
          entry_number: 'JE-2024-002',
          entry_date: '2024-01-02',
          description: 'Sales entry',
          status: 'draft',
        },
      ];

      const entriesQuery = createQueryMock({
        data: mockEntries,
        error: null,
        count: 2,
      });

      mockSupabaseClient.from.mockReturnValueOnce(userOrgQuery).mockReturnValueOnce(entriesQuery);

      const result = await getJournalEntries(mockOrganizationId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        items: mockEntries,
        pagination: {
          page: 1,
          pageSize: 50,
          totalCount: 2,
          totalPages: 1,
        },
      });
    });

    it('should apply filters correctly', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({
        data: { role: 'viewer' },
        error: null,
      });

      const queryMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      };

      mockSupabaseClient.from.mockReturnValueOnce(userOrgQuery).mockReturnValueOnce(queryMock);

      await getJournalEntries(mockOrganizationId, {
        accountingPeriodId: 'period-123',
        status: 'approved',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        search: 'sales',
      });

      expect(queryMock.eq).toHaveBeenCalledWith('accounting_period_id', 'period-123');
      expect(queryMock.eq).toHaveBeenCalledWith('status', 'approved');
      expect(queryMock.gte).toHaveBeenCalledWith('entry_date', '2024-01-01');
      expect(queryMock.lte).toHaveBeenCalledWith('entry_date', '2024-12-31');
      expect(queryMock.or).toHaveBeenCalledWith(
        'entry_number.ilike.%sales%,description.ilike.%sales%'
      );
    });

    it('should return unauthorized when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const result = await getJournalEntries(mockOrganizationId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('should return forbidden when user has no access to organization', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({
        data: null,
        error: new Error('Not found'),
      });

      mockSupabaseClient.from.mockReturnValueOnce(userOrgQuery);

      const result = await getJournalEntries(mockOrganizationId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.FORBIDDEN);
      expect(result.error?.message).toContain('この組織の仕訳を表示する権限がありません');
    });
  });

  describe('createJournalEntry', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockEntry = {
      organization_id: 'org-123',
      accounting_period_id: 'period-123',
      entry_number: 'JE-2024-001',
      entry_date: '2024-01-15',
      description: 'Test entry',
      status: 'draft' as const,
    };
    const mockLines = [
      {
        account_id: 'acc-1',
        debit_amount: 1000,
        credit_amount: null,
        description: 'Debit line',
        line_number: 1,
      },
      {
        account_id: 'acc-2',
        debit_amount: null,
        credit_amount: 1000,
        description: 'Credit line',
        line_number: 2,
      },
    ];

    it('should successfully create a journal entry with balanced lines', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock organization access check
      const userOrgQuery = createQueryMock({
        data: { role: 'accountant' },
        error: null,
      });

      // Mock accounting period check
      const periodQuery = createQueryMock({
        data: {
          id: 'period-123',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          is_closed: false,
        },
        error: null,
      });

      // Mock accounts existence check
      const accountsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [{ id: 'acc-1' }, { id: 'acc-2' }],
          error: null,
        }),
      };

      // Mock journal entry creation
      const createdEntry = { id: 'new-entry', ...mockEntry, created_by: mockUser.id };
      const createEntryQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: createdEntry,
          error: null,
        }),
      };

      // Mock lines creation
      const createdLines = mockLines.map((line, idx) => ({
        id: `line-${idx}`,
        journal_entry_id: 'new-entry',
        ...line,
      }));
      const createLinesQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: createdLines,
          error: null,
        }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(userOrgQuery)
        .mockReturnValueOnce(periodQuery)
        .mockReturnValueOnce(accountsQuery)
        .mockReturnValueOnce(createEntryQuery)
        .mockReturnValueOnce(createLinesQuery);

      const result = await createJournalEntry({
        entry: mockEntry,
        lines: mockLines,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        ...createdEntry,
        lines: createdLines,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/journal-entries');
    });

    it('should validate required fields', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({
        data: { role: 'admin' },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValueOnce(userOrgQuery);

      const incompleteEntry = {
        ...mockEntry,
        entry_number: '',
        entry_date: '',
        description: '',
      };

      const result = await createJournalEntry({
        entry: incompleteEntry,
        lines: mockLines,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('必須項目が入力されていません');
      expect(result.error?.details?.entry_number).toBeDefined();
      expect(result.error?.details?.entry_date).toBeDefined();
      expect(result.error?.details?.description).toBeDefined();
    });

    it('should validate debit/credit balance', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({
        data: { role: 'accountant' },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValueOnce(userOrgQuery);

      const unbalancedLines = [
        {
          account_id: 'acc-1',
          debit_amount: 1500,
          credit_amount: null,
          description: 'Debit line',
        },
        {
          account_id: 'acc-2',
          debit_amount: null,
          credit_amount: 1000,
          description: 'Credit line',
        },
      ];

      const result = await createJournalEntry({
        entry: mockEntry,
        lines: unbalancedLines,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('貸借が一致しません');
      expect(result.error?.details).toEqual({
        debit: 1500,
        credit: 1000,
        difference: 500,
      });
    });

    it('should prevent viewers from creating entries', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({
        data: { role: 'viewer' },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValueOnce(userOrgQuery);

      const result = await createJournalEntry({
        entry: mockEntry,
        lines: mockLines,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
      expect(result.error?.message).toContain('閲覧者は仕訳を作成できません');
    });

    it('should reject entries with no lines', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      const result = await createJournalEntry({
        entry: mockEntry,
        lines: [],
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('仕訳明細が入力されていません');
    });

    it('should check accounting period validity', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'accountant' },
        error: null,
      });

      // Accounting period not found
      fromMock.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Not found'),
      });

      const result = await createJournalEntry({
        entry: mockEntry,
        lines: mockLines,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('指定された会計期間が存在しません');
    });

    it('should prevent entry in closed accounting period', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      // Closed accounting period
      fromMock.single.mockResolvedValueOnce({
        data: {
          id: 'period-123',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          is_closed: true,
        },
        error: null,
      });

      const result = await createJournalEntry({
        entry: mockEntry,
        lines: mockLines,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INVALID_OPERATION);
      expect(result.error?.message).toContain('この会計期間は既に締められています');
    });

    it('should validate entry date within accounting period', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'accountant' },
        error: null,
      });

      fromMock.single.mockResolvedValueOnce({
        data: {
          id: 'period-123',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          is_closed: false,
        },
        error: null,
      });

      const entryOutOfPeriod = {
        ...mockEntry,
        entry_date: '2025-01-01', // Outside period
      };

      const result = await createJournalEntry({
        entry: entryOutOfPeriod,
        lines: mockLines,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('仕訳日付が会計期間の範囲外です');
    });

    it('should validate accounts existence', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      fromMock.single.mockResolvedValueOnce({
        data: {
          id: 'period-123',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          is_closed: false,
        },
        error: null,
      });

      // Only one account found
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [{ id: 'acc-1' }], // acc-2 not found
          error: null,
        }),
      });

      const result = await createJournalEntry({
        entry: mockEntry,
        lines: mockLines,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('指定された勘定科目が存在しません');
    });

    it('should validate partner existence when specified', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'accountant' },
        error: null,
      });

      fromMock.single.mockResolvedValueOnce({
        data: {
          id: 'period-123',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          is_closed: false,
        },
        error: null,
      });

      // Accounts exist
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [{ id: 'acc-1' }, { id: 'acc-2' }],
          error: null,
        }),
      });

      // Partner not found
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const linesWithPartner = mockLines.map((line) => ({
        ...line,
        partner_id: 'partner-123',
      }));

      const result = await createJournalEntry({
        entry: mockEntry,
        lines: linesWithPartner,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('指定された取引先が存在しません');
    });

    it('should handle transaction rollback on lines creation failure', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      fromMock.single.mockResolvedValueOnce({
        data: {
          id: 'period-123',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          is_closed: false,
        },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [{ id: 'acc-1' }, { id: 'acc-2' }],
          error: null,
        }),
      });

      // Entry creation succeeds
      const createdEntry = { id: 'new-entry', ...mockEntry };
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: createdEntry,
          error: null,
        }),
      });

      // Lines creation fails
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Lines creation failed'),
        }),
      });

      // Expect rollback delete
      const deleteMock = jest.fn().mockReturnThis();
      const eqMock = jest.fn().mockResolvedValue({ error: null });
      mockSupabaseClient.from.mockReturnValueOnce({
        delete: deleteMock,
        eq: eqMock,
      });

      const result = await createJournalEntry({
        entry: mockEntry,
        lines: mockLines,
      });

      expect(result.success).toBe(false);
      expect(deleteMock).toHaveBeenCalled();
      expect(eqMock).toHaveBeenCalledWith('id', 'new-entry');
    });
  });

  describe('updateJournalEntry', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const entryId = 'entry-123';
    const organizationId = 'org-123';
    const updateData = {
      description: 'Updated description',
      status: 'approved' as const,
    };

    it('should successfully update a journal entry', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      fromMock.single.mockResolvedValueOnce({
        data: { role: 'accountant' },
        error: null,
      });

      // Existing entry
      fromMock.single.mockResolvedValueOnce({
        data: { id: entryId, status: 'draft' },
        error: null,
      });

      // Update entry
      const updatedEntry = { id: entryId, ...updateData };
      mockSupabaseClient.from.mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: updatedEntry,
          error: null,
        }),
      });

      // Get existing lines
      const existingLines = [{ id: 'line-1', journal_entry_id: entryId }];
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: existingLines,
          error: null,
        }),
      });

      const result = await updateJournalEntry(entryId, organizationId, {
        entry: updateData,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        ...updatedEntry,
        lines: existingLines,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/journal-entries');
    });

    it('should prevent updating approved entries', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      fromMock.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      fromMock.single.mockResolvedValueOnce({
        data: { id: entryId, status: 'approved' },
        error: null,
      });

      const result = await updateJournalEntry(entryId, organizationId, {
        entry: updateData,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INVALID_OPERATION);
      expect(result.error?.message).toContain('承認済みの仕訳は更新できません');
    });

    it('should update lines when provided', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      fromMock.single.mockResolvedValueOnce({
        data: { role: 'accountant' },
        error: null,
      });

      fromMock.single.mockResolvedValueOnce({
        data: { id: entryId, status: 'draft' },
        error: null,
      });

      const newLines = [
        {
          account_id: 'acc-3',
          debit_amount: 2000,
          credit_amount: null,
          description: 'New debit',
        },
        {
          account_id: 'acc-4',
          debit_amount: null,
          credit_amount: 2000,
          description: 'New credit',
        },
      ];

      // Validate accounts
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [{ id: 'acc-3' }, { id: 'acc-4' }],
          error: null,
        }),
      });

      // Update entry
      mockSupabaseClient.from.mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: entryId },
          error: null,
        }),
      });

      // Delete old lines
      mockSupabaseClient.from.mockReturnValueOnce({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: null,
        }),
      });

      // Insert new lines
      const createdLines = newLines.map((line, idx) => ({
        id: `new-line-${idx}`,
        journal_entry_id: entryId,
        ...line,
      }));
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: createdLines,
          error: null,
        }),
      });

      const result = await updateJournalEntry(entryId, organizationId, {
        entry: updateData,
        lines: newLines,
      });

      expect(result.success).toBe(true);
      expect(result.data?.lines).toEqual(createdLines);
    });

    it('should validate balance when updating lines', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      fromMock.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      fromMock.single.mockResolvedValueOnce({
        data: { id: entryId, status: 'draft' },
        error: null,
      });

      const unbalancedLines = [
        {
          account_id: 'acc-1',
          debit_amount: 3000,
          credit_amount: null,
          description: 'Debit',
        },
        {
          account_id: 'acc-2',
          debit_amount: null,
          credit_amount: 2000,
          description: 'Credit',
        },
      ];

      const result = await updateJournalEntry(entryId, organizationId, {
        entry: updateData,
        lines: unbalancedLines,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('貸借が一致しません');
    });

    it('should prevent viewers from updating entries', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'viewer' },
        error: null,
      });

      const result = await updateJournalEntry(entryId, organizationId, {
        entry: updateData,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
      expect(result.error?.message).toContain('閲覧者は仕訳を更新できません');
    });
  });

  describe('deleteJournalEntry', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const entryId = 'entry-123';
    const organizationId = 'org-123';

    it('should successfully delete a journal entry', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      // Only admin can delete
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      // Entry exists and is draft
      fromMock.single.mockResolvedValueOnce({
        data: { id: entryId, status: 'draft' },
        error: null,
      });

      // Delete lines first
      mockSupabaseClient.from.mockReturnValueOnce({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: null,
        }),
      });

      // Delete entry
      mockSupabaseClient.from.mockReturnValueOnce({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: null,
        }),
      });

      const result = await deleteJournalEntry(entryId, organizationId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: entryId });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/journal-entries');
    });

    it('should prevent non-admins from deleting entries', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'accountant' },
        error: null,
      });

      const result = await deleteJournalEntry(entryId, organizationId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
      expect(result.error?.message).toContain('管理者のみが仕訳を削除できます');
    });

    it('should prevent deleting approved entries', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      fromMock.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      fromMock.single.mockResolvedValueOnce({
        data: { id: entryId, status: 'approved' },
        error: null,
      });

      const result = await deleteJournalEntry(entryId, organizationId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INVALID_OPERATION);
      expect(result.error?.message).toContain('承認済みの仕訳は削除できません');
    });

    it('should return not found for non-existent entry', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      fromMock.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      fromMock.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Not found'),
      });

      const result = await deleteJournalEntry(entryId, organizationId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.NOT_FOUND);
      expect(result.error?.message).toContain('仕訳が見つかりません');
    });
  });

  describe('Error Handling', () => {
    it('should handle Supabase errors gracefully', async () => {
      const supabaseError = {
        code: '23503',
        message: 'foreign key violation',
        details: 'Key not present in table',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: null,
          error: supabaseError,
        }),
      });

      const result = await getJournalEntries('org-123');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle network errors', async () => {
      mockCreateClient.mockRejectedValue(new Error('Network error'));

      const result = await getJournalEntries('org-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    });
  });
});
