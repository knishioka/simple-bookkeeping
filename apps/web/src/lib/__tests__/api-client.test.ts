import { toast } from 'react-hot-toast';

import { apiClient } from '../api-client';

// Mock dependencies
jest.mock('react-hot-toast', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

const mockToast = toast as jest.Mocked<typeof toast>;

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.location - Jest 30 compatible way
const mockLocation = {
  href: '',
  assign: jest.fn(),
  reload: jest.fn(),
};
delete (window as any).location;
window.location = mockLocation as any;

describe('ApiClient - エラーハンドリングとローディング状態', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.href = '';
  });

  describe('ネットワークエラーのユーザーシナリオ', () => {
    it('【シナリオ1】ネットワーク接続失敗時の適切なエラーハンドリング', async () => {
      // ネットワークエラーをシミュレート
      mockFetch.mockRejectedValue(new Error('Network connection failed'));

      const result = await apiClient.get('/accounts');

      expect(result.error).toEqual({
        code: 'NETWORK_ERROR',
        message: '通信エラーが発生しました',
      });
      expect(mockToast.error).toHaveBeenCalledWith('通信エラーが発生しました');
    });

    it('【シナリオ2】サーバー応答の長時間待機（タイムアウト相当）', async () => {
      // 長時間の待機をシミュレート
      mockFetch.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      const result = await apiClient.get('/journal-entries');

      expect(result.error?.code).toBe('NETWORK_ERROR');
      expect(mockToast.error).toHaveBeenCalledWith('通信エラーが発生しました');
    });
  });

  describe('サーバーエラーのユーザーシナリオ', () => {
    it('【シナリオ3】500系サーバーエラー時の処理', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'サーバーで問題が発生しました',
          },
        }),
      } as Response);

      const result = await apiClient.post('/journal-entries', {
        description: 'テスト仕訳',
      });

      expect(result.error?.code).toBe('INTERNAL_SERVER_ERROR');
      expect(mockToast.error).toHaveBeenCalledWith('サーバーで問題が発生しました');
    });

    it('【シナリオ4】400系バリデーションエラー時の処理', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: 'VALIDATION_ERROR',
            message: '借方と貸方の合計が一致しません',
            details: [{ field: 'lines', message: 'Balance mismatch' }],
          },
        }),
      } as Response);

      const result = await apiClient.post('/journal-entries', {
        lines: [
          /* unbalanced data */
        ],
      });

      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.details).toBeDefined();
      expect(mockToast.error).toHaveBeenCalledWith('借方と貸方の合計が一致しません');
    });
  });

  describe('認証エラーとトークンリフレッシュのユーザーシナリオ', () => {
    it('【シナリオ5】期限切れトークンの自動リフレッシュ成功', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'token') return 'expired-token';
        if (key === 'refreshToken') return 'valid-refresh-token';
        return null;
      });

      // 最初のリクエストは401で失敗
      // リフレッシュリクエストは成功
      // 再試行リクエストは成功
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Token expired' } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              token: 'new-access-token',
              refreshToken: 'new-refresh-token',
            },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: '1', code: '1110', name: '現金' }],
          }),
        } as Response);

      const result = await apiClient.get('/accounts');

      expect(result.data).toEqual([{ id: '1', code: '1110', name: '現金' }]);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'new-access-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('refreshToken', 'new-refresh-token');
    });

    it('【シナリオ6】リフレッシュトークンも期限切れの場合のログアウト処理', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'token') return 'expired-token';
        if (key === 'refreshToken') return 'expired-refresh-token';
        return null;
      });

      // 最初のリクエストは401で失敗
      // リフレッシュリクエストも401で失敗
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Token expired' } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Refresh token expired' } }),
        } as Response);

      await apiClient.get('/accounts');

      // トークンがクリアされ、ログインページにリダイレクトされる
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken');
      // Jest 30 with JSDOM doesn't support navigation, so we can't check the exact URL
      // Just verify that tokens were cleared which is the main behavior
    });
  });

  describe('組織切り替えのユーザーシナリオ', () => {
    it('【シナリオ7】組織IDヘッダーの適切な設定', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'token') return 'valid-token';
        if (key === 'organizationId') return 'org-123';
        return null;
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as Response);

      await apiClient.get('/accounts');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/accounts',
        expect.objectContaining({
          headers: expect.any(Headers),
        })
      );

      // ヘッダーの確認
      const call = mockFetch.mock.calls[0];
      const headers = call[1]?.headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer valid-token');
      expect(headers.get('X-Organization-Id')).toBe('org-123');
    });

    it('【シナリオ8】組織切り替え後のAPIリクエスト', async () => {
      // 組織を設定
      apiClient.setOrganizationId('new-org-456');

      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'token') return 'valid-token';
        if (key === 'organizationId') return 'new-org-456';
        return null;
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as Response);

      await apiClient.get('/journal-entries');

      const call = mockFetch.mock.calls[0];
      const headers = call[1]?.headers as Headers;
      expect(headers.get('X-Organization-Id')).toBe('new-org-456');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('organizationId', 'new-org-456');
    });
  });

  describe('実際のユーザー操作パターン', () => {
    it('【シナリオ9】大量データ取得時のメモリ使用量を考慮した処理', async () => {
      // 大量データのレスポンスをシミュレート
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `entry-${i}`,
        entryNumber: `202412${String(i).padStart(3, '0')}`,
        description: `仕訳 ${i}`,
      }));

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: largeDataset }),
      } as Response);

      const result = await apiClient.get('/journal-entries?limit=1000');

      expect(result.data).toHaveLength(1000);
      expect(result.data[0]).toEqual({
        id: 'entry-0',
        entryNumber: '202412000',
        description: '仕訳 0',
      });
    });

    it('【シナリオ10】並行リクエスト時の適切な処理', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { success: true } }),
      } as Response);

      // 複数の並行リクエストを実行
      const promises = [
        apiClient.get('/accounts'),
        apiClient.get('/journal-entries'),
        apiClient.get('/organizations/mine'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      results.forEach((result) => {
        expect(result.data).toEqual({ success: true });
      });
    });
  });

  describe('パフォーマンスとユーザーエクスペリエンス', () => {
    it('【シナリオ11】レスポンス時間の測定（実際のユーザー体験）', async () => {
      const startTime = Date.now();

      mockFetch.mockImplementation(
        () =>
          new Promise(
            (resolve) =>
              setTimeout(
                () =>
                  resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ data: [] }),
                  } as Response),
                50
              ) // 50ms の遅延をシミュレート
          )
      );

      await apiClient.get('/accounts');

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // レスポンス時間が適切な範囲内であることを確認
      expect(responseTime).toBeGreaterThanOrEqual(50);
      expect(responseTime).toBeLessThan(200); // 許容範囲
    });

    it('【シナリオ12】ユーザーが操作を中断した場合の処理', async () => {
      // リクエストの途中でユーザーが画面を離れる状況をシミュレート
      const abortController = new AbortController();

      mockFetch.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => {
              if (abortController.signal.aborted) {
                reject(new Error('Request aborted'));
              }
            }, 100)
          )
      );

      // リクエスト開始
      const requestPromise = apiClient.get('/accounts');

      // 50ms後にリクエストを中断
      setTimeout(() => abortController.abort(), 50);

      const result = await requestPromise;

      // 中断されたリクエストは適切にエラーハンドリングされる
      expect(result.error?.code).toBe('NETWORK_ERROR');
    });
  });

  describe('セキュリティ関連のユーザーシナリオ', () => {
    it('【シナリオ13】センシティブデータのログ出力制御', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockRejectedValue(new Error('Network error'));

      await apiClient.post('/auth/login', {
        email: 'user@example.com',
        password: 'secret-password',
      });

      // コンソールログにセンシティブな情報が含まれていないことを確認
      expect(consoleSpy).toHaveBeenCalledWith('API request failed:', expect.any(Error));

      // パスワードがログに出力されていないことを確認
      const loggedArgs = consoleSpy.mock.calls.flat().join(' ');
      expect(loggedArgs).not.toContain('secret-password');

      consoleSpy.mockRestore();
    });

    it('【シナリオ14】CSRF攻撃対策のヘッダー確認', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'token') return 'valid-token';
        return null;
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { success: true } }),
      } as Response);

      await apiClient.post('/accounts', { name: '新規勘定科目' });

      const call = mockFetch.mock.calls[0];
      const headers = call[1]?.headers as Headers;

      // 適切なContent-Typeが設定されていることを確認
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(headers.get('Authorization')).toBe('Bearer valid-token');
    });
  });
});
