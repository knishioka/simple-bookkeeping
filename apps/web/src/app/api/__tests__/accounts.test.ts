/**
 * 勘定科目API Routesのテスト
 */
import { NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

import { GET, POST } from '../accounts/route';

// Supabaseクライアントのモック
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

describe('Accounts API Route', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
    };
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/accounts', () => {
    it('should return accounts list for authenticated user', async () => {
      // モックデータ
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      const mockAccounts = [
        {
          id: 'acc-1',
          code: '1000',
          name: '現金',
          account_type: 'asset',
          category: 'current_asset',
        },
        {
          id: 'acc-2',
          code: '2000',
          name: '売掛金',
          account_type: 'asset',
          category: 'current_asset',
        },
      ];

      // モックの設定
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: mockAccounts,
          error: null,
          count: 2,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      // リクエストの作成
      const request = new NextRequest('http://localhost:3000/api/accounts?page=1&limit=20');

      // APIを実行
      const response = await GET(request);
      const data = await response.json();

      // 検証
      expect(response.status).toBe(200);
      expect(data.data).toEqual(mockAccounts);
      expect(data.meta).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should return 401 for unauthenticated user', async () => {
      // 認証エラーを設定
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Unauthorized'),
      });

      const request = new NextRequest('http://localhost:3000/api/accounts');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should apply filters correctly', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      // フィルタ付きリクエスト
      const request = new NextRequest(
        'http://localhost:3000/api/accounts?account_type=asset&category=current_asset&search=現金'
      );

      await GET(request);

      // フィルタが適用されたことを確認
      expect(mockQuery.eq).toHaveBeenCalledWith('account_type', 'asset');
      expect(mockQuery.eq).toHaveBeenCalledWith('category', 'current_asset');
      expect(mockQuery.or).toHaveBeenCalledWith('name.ilike.%現金%,code.ilike.%現金%');
    });
  });

  describe('POST /api/accounts', () => {
    it('should create a new account', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      const mockOrgData = { organization_id: 'org-1' };
      const newAccount = {
        code: '3000',
        name: '預金',
        account_type: 'asset',
        category: 'current_asset',
      };
      const createdAccount = {
        id: 'acc-3',
        organization_id: 'org-1',
        ...newAccount,
      };

      // モックの設定
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockOrgQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockOrgData,
          error: null,
        }),
      };

      const mockExistingQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      const mockInsertQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: createdAccount,
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockOrgQuery) // user_organizations
        .mockReturnValueOnce(mockExistingQuery) // 重複チェック
        .mockReturnValueOnce(mockInsertQuery); // insert

      // リクエストの作成
      const request = new NextRequest('http://localhost:3000/api/accounts', {
        method: 'POST',
        body: JSON.stringify(newAccount),
      });

      // APIを実行
      const response = await POST(request);
      const data = await response.json();

      // 検証
      expect(response.status).toBe(201);
      expect(data.data).toEqual(createdAccount);
    });

    it('should return 409 for duplicate account code', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      const mockOrgData = { organization_id: 'org-1' };
      const duplicateAccount = {
        code: '1000', // 既に存在するコード
        name: '現金2',
        account_type: 'asset',
        category: 'current_asset',
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockOrgQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockOrgData,
          error: null,
        }),
      };

      const mockExistingQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'existing-acc' }, // 既存のアカウント
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValueOnce(mockOrgQuery).mockReturnValueOnce(mockExistingQuery);

      const request = new NextRequest('http://localhost:3000/api/accounts', {
        method: 'POST',
        body: JSON.stringify(duplicateAccount),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Account code already exists');
    });

    it('should return 400 for missing required fields', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const invalidAccount = {
        name: '預金', // codeが不足
        account_type: 'asset',
      };

      const request = new NextRequest('http://localhost:3000/api/accounts', {
        method: 'POST',
        body: JSON.stringify(invalidAccount),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Required fields are missing');
    });
  });
});
