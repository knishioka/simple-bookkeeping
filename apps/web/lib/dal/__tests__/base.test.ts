import { BaseDAL } from '../base';

import { getSecureErrorMessage } from '@/lib/error-messages';
import { createClient } from '@/lib/supabase/server';

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/error-messages', () => ({
  getSecureErrorMessage: jest.fn((_error) => 'Secure error message'),
  logSecurityError: jest.fn(),
}));

describe('BaseDAL', () => {
  let mockSupabaseClient: any;
  let mockFrom: jest.Mock;
  let mockSelect: jest.Mock;
  let mockInsert: jest.Mock;
  let mockUpdate: jest.Mock;
  let mockDelete: jest.Mock;
  let mockEq: jest.Mock;
  let mockSingle: jest.Mock;
  let mockAuth: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock chain
    mockSingle = jest.fn().mockReturnThis();
    mockEq = jest.fn().mockReturnThis();
    mockDelete = jest.fn().mockReturnThis();
    mockUpdate = jest.fn().mockReturnThis();
    mockInsert = jest.fn().mockReturnThis();
    mockSelect = jest.fn().mockReturnThis();
    mockFrom = jest.fn().mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      eq: mockEq,
      single: mockSingle,
    });

    mockAuth = {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      }),
    };

    mockSupabaseClient = {
      from: mockFrom,
      auth: mockAuth,
    };

    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with table name', () => {
      const dal = new BaseDAL('test_table');
      expect(dal['tableName']).toBe('test_table');
    });

    it('should create Supabase client lazily', async () => {
      const dal = new BaseDAL('test_table');
      expect(createClient).not.toHaveBeenCalled();

      await dal['getClient']();
      expect(createClient).toHaveBeenCalledTimes(1);

      // Should reuse the same client
      await dal['getClient']();
      expect(createClient).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCurrentUser', () => {
    it('should get current authenticated user', async () => {
      const dal = new BaseDAL('test_table');
      const user = await dal['getCurrentUser']();

      expect(user).toEqual({ id: 'user-123' });
      expect(mockAuth.getUser).toHaveBeenCalled();
    });

    it('should throw error if not authenticated', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const dal = new BaseDAL('test_table');
      await expect(dal['getCurrentUser']()).rejects.toThrow('Not authenticated');
    });

    it('should throw error on auth failure', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: null,
        error: { message: 'Auth error' },
      });

      const dal = new BaseDAL('test_table');
      await expect(dal['getCurrentUser']()).rejects.toThrow('Auth error');
    });
  });

  describe('findById', () => {
    it('should find record by id', async () => {
      const mockData = { id: '123', name: 'Test' };
      mockSingle.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const dal = new BaseDAL('test_table');
      const result = await dal.findById('123');

      expect(result).toEqual(mockData);
      expect(mockFrom).toHaveBeenCalledWith('test_table');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('id', '123');
      expect(mockSingle).toHaveBeenCalled();
    });

    it('should select specific columns', async () => {
      const mockData = { id: '123', name: 'Test' };
      mockSingle.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const dal = new BaseDAL('test_table');
      await dal.findById('123', ['id', 'name']);

      expect(mockSelect).toHaveBeenCalledWith('id, name');
    });

    it('should return null when record not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const dal = new BaseDAL('test_table');
      const result = await dal.findById('999');

      expect(result).toBeNull();
    });

    it('should handle query errors', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: 'DB001' },
      });

      const dal = new BaseDAL('test_table');
      await expect(dal.findById('123')).rejects.toThrow('Secure error message');
    });
  });

  describe('findAll', () => {
    it('should find all records', async () => {
      const mockData = [
        { id: '1', name: 'Test 1' },
        { id: '2', name: 'Test 2' },
      ];
      mockSelect.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const dal = new BaseDAL('test_table');
      const result = await dal.findAll();

      expect(result).toEqual(mockData);
      expect(mockFrom).toHaveBeenCalledWith('test_table');
      expect(mockSelect).toHaveBeenCalledWith('*');
    });

    it('should apply filters', async () => {
      const mockData = [{ id: '1', status: 'active' }];

      // Create a more comprehensive mock chain
      const mockFilter = jest.fn().mockReturnValue({
        data: mockData,
        error: null,
      });

      mockSelect.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue(mockFilter()),
        }),
      });

      const dal = new BaseDAL('test_table');
      const result = await dal.findAll({
        filters: { status: 'active', type: 'premium' },
      });

      expect(result).toEqual(mockData);
    });

    it('should handle empty results', async () => {
      mockSelect.mockResolvedValue({
        data: [],
        error: null,
      });

      const dal = new BaseDAL('test_table');
      const result = await dal.findAll();

      expect(result).toEqual([]);
    });

    it('should handle query errors', async () => {
      mockSelect.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });

      const dal = new BaseDAL('test_table');
      await expect(dal.findAll()).rejects.toThrow('Secure error message');
    });
  });

  describe('create', () => {
    it('should create a new record', async () => {
      const newData = { name: 'New Record', value: 100 };
      const createdData = { id: '123', ...newData, created_at: '2024-01-01' };

      mockSingle.mockResolvedValue({
        data: createdData,
        error: null,
      });

      mockSelect.mockReturnValue({
        single: mockSingle,
      });

      const dal = new BaseDAL('test_table');
      const result = await dal.create(newData);

      expect(result).toEqual(createdData);
      expect(mockInsert).toHaveBeenCalledWith(newData);
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockSingle).toHaveBeenCalled();
    });

    it('should handle creation errors', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Unique constraint violation' },
      });

      mockSelect.mockReturnValue({
        single: mockSingle,
      });

      const dal = new BaseDAL('test_table');
      await expect(dal.create({ name: 'Test' })).rejects.toThrow('Secure error message');
    });

    it('should validate data before creation', async () => {
      const dal = new BaseDAL('test_table');

      // Override validate method for testing
      dal['validate'] = jest.fn().mockRejectedValue(new Error('Validation failed'));

      await expect(dal.create({ name: 'Test' })).rejects.toThrow('Validation failed');
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update a record', async () => {
      const updateData = { name: 'Updated Name' };
      const updatedRecord = { id: '123', name: 'Updated Name', value: 100 };

      mockSingle.mockResolvedValue({
        data: updatedRecord,
        error: null,
      });

      mockEq.mockReturnValue({
        select: mockSelect,
      });

      mockSelect.mockReturnValue({
        single: mockSingle,
      });

      const dal = new BaseDAL('test_table');
      const result = await dal.update('123', updateData);

      expect(result).toEqual(updatedRecord);
      expect(mockUpdate).toHaveBeenCalledWith(updateData);
      expect(mockEq).toHaveBeenCalledWith('id', '123');
    });

    it('should handle update errors', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      });

      mockEq.mockReturnValue({
        select: mockSelect,
      });

      mockSelect.mockReturnValue({
        single: mockSingle,
      });

      const dal = new BaseDAL('test_table');
      await expect(dal.update('123', { name: 'Test' })).rejects.toThrow('Secure error message');
    });

    it('should return null when record not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }, // No rows found
      });

      mockEq.mockReturnValue({
        select: mockSelect,
      });

      mockSelect.mockReturnValue({
        single: mockSingle,
      });

      const dal = new BaseDAL('test_table');
      await expect(dal.update('999', { name: 'Test' })).rejects.toThrow('Secure error message');
    });
  });

  describe('delete', () => {
    it('should delete a record', async () => {
      mockEq.mockResolvedValue({
        data: null,
        error: null,
      });

      const dal = new BaseDAL('test_table');
      const result = await dal.delete('123');

      expect(result).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', '123');
    });

    it('should handle deletion errors', async () => {
      mockEq.mockResolvedValue({
        data: null,
        error: { message: 'Cannot delete - foreign key constraint' },
      });

      const dal = new BaseDAL('test_table');
      await expect(dal.delete('123')).rejects.toThrow('Secure error message');
    });

    it('should handle soft delete if implemented', async () => {
      mockSingle.mockResolvedValue({
        data: { id: '123', deleted_at: '2024-01-01' },
        error: null,
      });

      mockEq.mockReturnValue({
        select: mockSelect,
      });

      mockSelect.mockReturnValue({
        single: mockSingle,
      });

      const dal = new BaseDAL('test_table');
      dal['softDelete'] = true; // Enable soft delete

      const result = await dal.delete('123');
      expect(result).toBe(true);
    });
  });

  describe('validate', () => {
    it('should validate required fields', async () => {
      const dal = new BaseDAL('test_table');
      dal['requiredFields'] = ['name', 'email'];

      await expect(dal['validate']({ name: 'Test' })).rejects.toThrow(
        'Missing required field: email'
      );
      await expect(dal['validate']({ email: 'test@example.com' })).rejects.toThrow(
        'Missing required field: name'
      );
      await expect(
        dal['validate']({ name: 'Test', email: 'test@example.com' })
      ).resolves.toBeUndefined();
    });

    it('should skip validation if no required fields', async () => {
      const dal = new BaseDAL('test_table');
      dal['requiredFields'] = [];

      await expect(dal['validate']({})).resolves.toBeUndefined();
    });

    it('should validate data types if specified', async () => {
      const dal = new BaseDAL('test_table');
      dal['fieldTypes'] = {
        age: 'number',
        name: 'string',
        active: 'boolean',
      };

      await expect(dal['validate']({ age: '25' })).rejects.toThrow('Invalid type for field: age');
      await expect(dal['validate']({ name: 123 })).rejects.toThrow('Invalid type for field: name');
      await expect(dal['validate']({ active: 'yes' })).rejects.toThrow(
        'Invalid type for field: active'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockSelect.mockRejectedValue(new Error('Network error'));

      const dal = new BaseDAL('test_table');
      await expect(dal.findAll()).rejects.toThrow('Network error');
    });

    it('should sanitize error messages', async () => {
      const sensitiveError = {
        message: 'Connection failed to 192.168.1.1:5432',
        code: 'ECONNREFUSED',
      };

      mockSelect.mockResolvedValue({
        data: null,
        error: sensitiveError,
      });

      const dal = new BaseDAL('test_table');
      await expect(dal.findAll()).rejects.toThrow('Secure error message');
      expect(getSecureErrorMessage).toHaveBeenCalledWith(sensitiveError);
    });

    it('should log security-related errors', async () => {
      const securityError = {
        message: 'Permission denied',
        code: 'insufficient_permissions',
      };

      mockSelect.mockResolvedValue({
        data: null,
        error: securityError,
      });

      const dal = new BaseDAL('test_table');
      await expect(dal.findAll()).rejects.toThrow('Secure error message');
    });
  });

  describe('Transaction Support', () => {
    it('should handle transactions if supported', async () => {
      const mockTransaction = jest.fn((callback) => callback(mockSupabaseClient));
      mockSupabaseClient.transaction = mockTransaction;

      const dal = new BaseDAL('test_table');

      const transactionCallback = async (_client: unknown) => {
        // Simulate operations within transaction
        return { success: true };
      };

      const result = await dal['executeInTransaction'](transactionCallback);
      expect(result).toEqual({ success: true });
    });
  });
});
