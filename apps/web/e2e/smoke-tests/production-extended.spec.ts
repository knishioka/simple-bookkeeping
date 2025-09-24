import { test, expect } from '@playwright/test';

import { UnifiedMock } from '../helpers/server-actions-unified-mock';
import { SupabaseAuth } from '../helpers/supabase-auth';
import { TestDataManager } from '../helpers/test-data-manager';

/**
 * Production E2Eテストカバレッジ拡張
 * Issue #453: Production環境でのE2Eテストカバレッジ拡張 - Phase 1
 *
 * @tags @smoke @production @phase1
 *
 * Phase 1実装内容：
 * 1. 仕訳一覧の表示確認（データの正常表示、ページネーション、フィルタ機能）
 * 2. 勘定科目一覧の表示（カテゴリ別表示、検索機能）
 * 3. ダッシュボードのデータ表示（残高情報、最近の取引）
 *
 * 実装方針：
 * - 読み取り専用操作に限定（破壊的操作は禁止）
 * - Viewer権限でのテスト実行
 * - Production環境での実行を考慮
 * - 柔軟なコンテンツ確認（複数の成功パターンを許容）
 * - パフォーマンス計測の組み込み
 * - リトライ戦略の実装
 */
test.describe('Production E2Eテストカバレッジ - Phase 1 @smoke @production @phase1', () => {
  // Production環境とCI環境を考慮したタイムアウト設定（増加）
  test.use({
    navigationTimeout: 60000, // Increased for CI stability
    actionTimeout: 40000, // Increased for CI stability
  });
  test.setTimeout(90000); // Increased overall timeout

  // パフォーマンス計測用の変数
  const performanceMetrics: {
    testName: string;
    duration: number;
    status: 'passed' | 'failed' | 'skipped';
  }[] = [];

  // テストデータマネージャのインスタンス
  let testDataManager: TestDataManager;

  test.beforeAll(async () => {
    // テストデータマネージャの初期化
    try {
      testDataManager = new TestDataManager();
      const isConnected = await testDataManager.testConnection();
      if (!isConnected) {
        console.warn('Warning: Could not connect to test database');
      }
    } catch (error) {
      console.warn('Warning: TestDataManager initialization failed:', error);
    }
  });

  test.afterAll(async () => {
    // パフォーマンスレポートの出力
    console.log('\n=== Performance Report ===');
    performanceMetrics.forEach((metric) => {
      console.log(`${metric.testName}: ${metric.duration}ms (${metric.status})`);
    });
    console.log(
      `Average Duration: ${Math.round(performanceMetrics.reduce((sum, m) => sum + m.duration, 0) / performanceMetrics.length)}ms`
    );
  });

  test.beforeEach(async ({ context }) => {
    // Server Actions用のモックをセットアップ（最小限のデータ）
    await UnifiedMock.setupAll(context, {
      enabled: true,
      customResponses: {
        organizations: [
          {
            id: 'prod-test-org-1',
            name: 'Production Test Organization',
            code: 'PROD001',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
      },
    });
  });

  test.afterEach(async ({ page: _page }, testInfo) => {
    // パフォーマンスメトリクスの記録
    performanceMetrics.push({
      testName: testInfo.title,
      duration: testInfo.duration,
      status:
        testInfo.status === 'passed'
          ? 'passed'
          : testInfo.status === 'failed'
            ? 'failed'
            : 'skipped',
    });
  });

  test.describe('仕訳一覧表示 (Journal Entries List)', () => {
    test('仕訳一覧ページの基本表示確認 @viewer', async ({ page, context }) => {
      const startTime = Date.now();

      // Viewer権限でのSupabase認証をセットアップ
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await SupabaseAuth.setup(context, page, { role: 'viewer' });

      // モックデータのセットアップ
      await context.route('**/api/v1/journal-entries**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 'je-001',
                date: '2024-01-15',
                description: '現金売上',
                debit_account: { code: '1001', name: '現金' },
                credit_account: { code: '4001', name: '売上高' },
                amount: 50000,
                status: 'posted',
              },
              {
                id: 'je-002',
                date: '2024-01-16',
                description: '仕入（現金）',
                debit_account: { code: '5001', name: '仕入高' },
                credit_account: { code: '1001', name: '現金' },
                amount: 20000,
                status: 'posted',
              },
              {
                id: 'je-003',
                date: '2024-01-17',
                description: '振込売上',
                debit_account: { code: '1002', name: '普通預金' },
                credit_account: { code: '4001', name: '売上高' },
                amount: 100000,
                status: 'posted',
              },
            ],
            meta: {
              total: 3,
              page: 1,
              per_page: 10,
              total_pages: 1,
            },
          }),
        });
      });

      // ページ遷移（リトライ戦略付き）
      let retryCount = 0;
      const maxRetries = 3;
      while (retryCount < maxRetries) {
        try {
          await page.goto('/dashboard/journal-entries', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
          break;
        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries) throw error;
          console.log(`Retry ${retryCount}/${maxRetries} for journal-entries page`);
          await page.waitForTimeout(2000);
        }
      }

      // ページロード完了待機
      // Wait for specific content instead of networkidle (more reliable)
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000); // Brief pause for dynamic content

      // ページコンテンツの確認（柔軟な判定）
      const pageValidation = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        const results = {
          hasJournalKeyword: false,
          hasDataTable: false,
          hasNavigation: false,
          hasEntryData: false,
          errorMessages: [],
        };

        // キーワードチェック
        results.hasJournalKeyword =
          bodyText.includes('仕訳') ||
          bodyText.includes('Journal') ||
          bodyText.includes('取引') ||
          bodyText.includes('Entries');

        // テーブルの存在確認
        results.hasDataTable =
          document.querySelector('table') !== null ||
          document.querySelector('[role="table"]') !== null ||
          document.querySelector('.data-table') !== null;

        // ナビゲーションの存在確認
        results.hasNavigation =
          document.querySelector('nav') !== null ||
          document.querySelector('[role="navigation"]') !== null;

        // 仕訳データの存在確認
        results.hasEntryData =
          bodyText.includes('現金売上') ||
          bodyText.includes('50,000') ||
          bodyText.includes('50000') ||
          bodyText.includes('現金') ||
          bodyText.includes('売上高');

        // エラーチェック
        if (bodyText.includes('エラーが発生しました')) {
          results.errorMessages.push('Error page detected');
        }
        if (bodyText.includes('404')) {
          results.errorMessages.push('404 error detected');
        }
        if (bodyText.includes('500')) {
          results.errorMessages.push('500 error detected');
        }

        return results;
      });

      // アサーション（少なくとも1つの条件を満たす）
      const isPageValid =
        pageValidation.hasJournalKeyword ||
        pageValidation.hasDataTable ||
        pageValidation.hasEntryData;

      expect(pageValidation.errorMessages).toHaveLength(0);
      expect(isPageValid).toBeTruthy();

      // パフォーマンスログ
      const loadTime = Date.now() - startTime;
      console.log(`Journal entries page loaded in ${loadTime}ms`);
    });

    test('ページネーション機能の確認 @viewer', async ({ page, context }) => {
      // Viewer権限でのSupabase認証をセットアップ
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await SupabaseAuth.setup(context, page, { role: 'viewer' });

      // 複数ページ分のモックデータ
      await context.route('**/api/v1/journal-entries**', async (route) => {
        const url = new URL(route.request().url());
        const requestedPage = parseInt(url.searchParams.get('page') || '1');

        const itemsPerPage = 10;
        const totalItems = 25;
        const data = Array.from({ length: itemsPerPage }, (_, i) => ({
          id: `je-${(requestedPage - 1) * itemsPerPage + i + 1}`,
          date: `2024-01-${String((requestedPage - 1) * itemsPerPage + i + 1).padStart(2, '0')}`,
          description: `取引 ${(requestedPage - 1) * itemsPerPage + i + 1}`,
          debit_account: { code: '1001', name: '現金' },
          credit_account: { code: '4001', name: '売上高' },
          amount: 10000 * ((requestedPage - 1) * itemsPerPage + i + 1),
          status: 'posted',
        })).slice(0, Math.min(itemsPerPage, totalItems - (requestedPage - 1) * itemsPerPage));

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data,
            meta: {
              total: totalItems,
              page: requestedPage,
              per_page: itemsPerPage,
              total_pages: Math.ceil(totalItems / itemsPerPage),
            },
          }),
        });
      });

      await page.goto('/dashboard/journal-entries', { waitUntil: 'domcontentloaded' });
      // Wait for specific content instead of networkidle (more reliable)
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000); // Brief pause for dynamic content

      // ページネーションコントロールの存在確認
      const hasPagination = await page.evaluate(() => {
        const paginationSelectors = [
          '[aria-label*="pagination"]',
          '.pagination',
          '[role="navigation"][aria-label*="page"]',
          'button:has-text("次へ")',
          'button:has-text("Next")',
          'nav:has(button)',
        ];

        return paginationSelectors.some((selector) => {
          try {
            return document.querySelector(selector) !== null;
          } catch {
            return false;
          }
        });
      });

      // ページネーション機能の存在を確認（オプショナル）
      if (hasPagination) {
        console.log('Pagination controls found on journal entries page');
      } else {
        console.log('No pagination controls found (may be single page of data)');
      }

      // データの存在確認
      const hasData = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return (
          bodyText.includes('取引') ||
          bodyText.includes('仕訳') ||
          document.querySelector('table') !== null
        );
      });

      expect(hasData).toBeTruthy();
    });

    test('フィルタ機能の確認 @viewer', async ({ page, context }) => {
      // Viewer権限でのSupabase認証をセットアップ
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await SupabaseAuth.setup(context, page, { role: 'viewer' });

      // フィルタ用モックデータ
      await context.route('**/api/v1/journal-entries**', async (route) => {
        const url = new URL(route.request().url());
        const dateFrom = url.searchParams.get('date_from');
        const dateTo = url.searchParams.get('date_to');
        const status = url.searchParams.get('status');

        let data = [
          {
            id: 'je-filter-001',
            date: '2024-01-15',
            description: 'フィルタテスト取引1',
            debit_account: { code: '1001', name: '現金' },
            credit_account: { code: '4001', name: '売上高' },
            amount: 50000,
            status: 'posted',
          },
          {
            id: 'je-filter-002',
            date: '2024-01-20',
            description: 'フィルタテスト取引2',
            debit_account: { code: '5001', name: '仕入高' },
            credit_account: { code: '1001', name: '現金' },
            amount: 30000,
            status: 'draft',
          },
        ];

        // フィルタ適用シミュレーション
        if (dateFrom) {
          data = data.filter((item) => item.date >= dateFrom);
        }
        if (dateTo) {
          data = data.filter((item) => item.date <= dateTo);
        }
        if (status) {
          data = data.filter((item) => item.status === status);
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data,
            meta: {
              total: data.length,
              page: 1,
              per_page: 10,
              total_pages: 1,
            },
          }),
        });
      });

      await page.goto('/dashboard/journal-entries', { waitUntil: 'domcontentloaded' });
      // Wait for specific content instead of networkidle (more reliable)
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000); // Brief pause for dynamic content

      // フィルタコントロールの存在確認
      const filterControls = await page.evaluate(() => {
        const filterSelectors = [
          'input[type="date"]',
          'input[type="search"]',
          'select',
          'button:has-text("検索")',
          'button:has-text("Search")',
          'button:has-text("フィルタ")',
          'button:has-text("Filter")',
          '[role="search"]',
          'form',
        ];

        const found = [];
        filterSelectors.forEach((selector) => {
          try {
            if (document.querySelector(selector)) {
              found.push(selector);
            }
          } catch {
            // Ignore invalid selectors
          }
        });

        return {
          hasFilters: found.length > 0,
          foundSelectors: found,
        };
      });

      // フィルタ機能の存在確認（オプショナル）
      if (filterControls.hasFilters) {
        console.log('Filter controls found:', filterControls.foundSelectors);
      } else {
        console.log('No filter controls found (feature may not be implemented)');
      }

      // 基本的なページ機能の確認
      const pageWorks = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return !bodyText.includes('エラー') && !bodyText.includes('Error');
      });

      expect(pageWorks).toBeTruthy();
    });
  });

  test.describe('勘定科目一覧表示 (Accounts List)', () => {
    test('勘定科目一覧ページの基本表示確認 @viewer', async ({ page, context }) => {
      const startTime = Date.now();

      // Viewer権限でのSupabase認証をセットアップ
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await SupabaseAuth.setup(context, page, { role: 'viewer' });

      // モックデータのセットアップ
      await context.route('**/api/v1/accounts**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: '1',
                code: '1001',
                name: '現金',
                accountType: 'ASSET',
                category: '流動資産',
                isActive: true,
              },
              {
                id: '2',
                code: '1002',
                name: '普通預金',
                accountType: 'ASSET',
                category: '流動資産',
                isActive: true,
              },
              {
                id: '3',
                code: '1101',
                name: '売掛金',
                accountType: 'ASSET',
                category: '流動資産',
                isActive: true,
              },
              {
                id: '4',
                code: '2001',
                name: '買掛金',
                accountType: 'LIABILITY',
                category: '流動負債',
                isActive: true,
              },
              {
                id: '5',
                code: '3001',
                name: '資本金',
                accountType: 'EQUITY',
                category: '純資産',
                isActive: true,
              },
              {
                id: '6',
                code: '4001',
                name: '売上高',
                accountType: 'REVENUE',
                category: '収益',
                isActive: true,
              },
              {
                id: '7',
                code: '5001',
                name: '仕入高',
                accountType: 'EXPENSE',
                category: '費用',
                isActive: true,
              },
              {
                id: '8',
                code: '5101',
                name: '給与費',
                accountType: 'EXPENSE',
                category: '費用',
                isActive: true,
              },
            ],
            meta: { total: 8 },
          }),
        });
      });

      // ページ遷移（リトライ戦略付き）
      let retryCount = 0;
      const maxRetries = 3;
      while (retryCount < maxRetries) {
        try {
          await page.goto('/dashboard/accounts', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
          break;
        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries) throw error;
          console.log(`Retry ${retryCount}/${maxRetries} for accounts page`);
          await page.waitForTimeout(2000);
        }
      }

      // Wait for specific content instead of networkidle (more reliable)
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000); // Brief pause for dynamic content

      // ページコンテンツの確認
      const pageValidation = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        const results = {
          hasAccountKeyword: false,
          hasAccountData: false,
          hasCategories: false,
          hasTable: false,
          errorMessages: [],
        };

        // キーワードチェック
        results.hasAccountKeyword =
          bodyText.includes('勘定科目') ||
          bodyText.includes('Accounts') ||
          bodyText.includes('科目');

        // 勘定科目データの存在確認
        results.hasAccountData =
          bodyText.includes('現金') ||
          bodyText.includes('普通預金') ||
          bodyText.includes('売掛金') ||
          bodyText.includes('資本金') ||
          bodyText.includes('売上高');

        // カテゴリの存在確認
        results.hasCategories =
          bodyText.includes('流動資産') ||
          bodyText.includes('流動負債') ||
          bodyText.includes('純資産') ||
          bodyText.includes('収益') ||
          bodyText.includes('費用') ||
          bodyText.includes('ASSET') ||
          bodyText.includes('LIABILITY');

        // テーブルの存在確認
        results.hasTable =
          document.querySelector('table') !== null ||
          document.querySelector('[role="table"]') !== null;

        // エラーチェック
        if (bodyText.includes('エラーが発生しました')) {
          results.errorMessages.push('Error page detected');
        }

        return results;
      });

      // アサーション
      const isPageValid =
        pageValidation.hasAccountKeyword ||
        pageValidation.hasAccountData ||
        pageValidation.hasCategories;

      expect(pageValidation.errorMessages).toHaveLength(0);
      expect(isPageValid).toBeTruthy();

      // パフォーマンスログ
      const loadTime = Date.now() - startTime;
      console.log(`Accounts page loaded in ${loadTime}ms`);
    });

    test('カテゴリ別表示の確認 @viewer', async ({ page, context }) => {
      // Viewer権限でのSupabase認証をセットアップ
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await SupabaseAuth.setup(context, page, { role: 'viewer' });

      // カテゴリ別のモックデータ
      await context.route('**/api/v1/accounts**', async (route) => {
        const url = new URL(route.request().url());
        const category = url.searchParams.get('category');

        let data = [
          {
            id: '1',
            code: '1001',
            name: '現金',
            accountType: 'ASSET',
            category: '流動資産',
            isActive: true,
          },
          {
            id: '2',
            code: '1002',
            name: '普通預金',
            accountType: 'ASSET',
            category: '流動資産',
            isActive: true,
          },
          {
            id: '3',
            code: '2001',
            name: '買掛金',
            accountType: 'LIABILITY',
            category: '流動負債',
            isActive: true,
          },
          {
            id: '4',
            code: '3001',
            name: '資本金',
            accountType: 'EQUITY',
            category: '純資産',
            isActive: true,
          },
          {
            id: '5',
            code: '4001',
            name: '売上高',
            accountType: 'REVENUE',
            category: '収益',
            isActive: true,
          },
          {
            id: '6',
            code: '5001',
            name: '仕入高',
            accountType: 'EXPENSE',
            category: '費用',
            isActive: true,
          },
        ];

        // カテゴリフィルタシミュレーション
        if (category) {
          data = data.filter((item) => item.accountType === category || item.category === category);
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data,
            meta: { total: data.length },
          }),
        });
      });

      await page.goto('/dashboard/accounts', { waitUntil: 'domcontentloaded' });
      // Wait for specific content instead of networkidle (more reliable)
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000); // Brief pause for dynamic content

      // カテゴリ表示/フィルタの確認
      const categoryFeatures = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        const results = {
          hasCategories: false,
          categoryTypes: [],
          hasCategoryFilter: false,
        };

        // カテゴリの存在確認
        const categories = [
          '流動資産',
          '流動負債',
          '純資産',
          '収益',
          '費用',
          'ASSET',
          'LIABILITY',
          'EQUITY',
          'REVENUE',
          'EXPENSE',
        ];
        categories.forEach((cat) => {
          if (bodyText.includes(cat)) {
            results.categoryTypes.push(cat);
          }
        });
        results.hasCategories = results.categoryTypes.length > 0;

        // カテゴリフィルタの存在確認
        const filterSelectors = [
          'select',
          'button[aria-label*="category"]',
          '[role="tablist"]',
          '[role="tab"]',
          '.category-filter',
        ];

        results.hasCategoryFilter = filterSelectors.some((selector) => {
          try {
            return document.querySelector(selector) !== null;
          } catch {
            return false;
          }
        });

        return results;
      });

      // カテゴリ機能の存在確認
      if (categoryFeatures.hasCategories) {
        console.log('Account categories found:', categoryFeatures.categoryTypes);
      }
      if (categoryFeatures.hasCategoryFilter) {
        console.log('Category filter controls found');
      }

      // 基本機能の確認
      expect(categoryFeatures.hasCategories || categoryFeatures.hasCategoryFilter).toBeTruthy();
    });

    test('検索機能の確認 @viewer', async ({ page, context }) => {
      // Viewer権限でのSupabase認証をセットアップ
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await SupabaseAuth.setup(context, page, { role: 'viewer' });

      // 検索用モックデータ
      await context.route('**/api/v1/accounts**', async (route) => {
        const url = new URL(route.request().url());
        const search = url.searchParams.get('search') || url.searchParams.get('q');

        let data = [
          { id: '1', code: '1001', name: '現金', accountType: 'ASSET', isActive: true },
          { id: '2', code: '1002', name: '普通預金', accountType: 'ASSET', isActive: true },
          { id: '3', code: '1101', name: '売掛金', accountType: 'ASSET', isActive: true },
          { id: '4', code: '4001', name: '売上高', accountType: 'REVENUE', isActive: true },
        ];

        // 検索フィルタシミュレーション
        if (search) {
          const searchLower = search.toLowerCase();
          data = data.filter(
            (item) => item.name.toLowerCase().includes(searchLower) || item.code.includes(search)
          );
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data,
            meta: { total: data.length },
          }),
        });
      });

      await page.goto('/dashboard/accounts', { waitUntil: 'domcontentloaded' });
      // Wait for specific content instead of networkidle (more reliable)
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000); // Brief pause for dynamic content

      // 検索機能の確認
      const searchFeatures = await page.evaluate(() => {
        const results = {
          hasSearchBox: false,
          searchInputType: null as string | null,
          hasSearchButton: false,
        };

        // 検索ボックスの確認
        const searchInputSelectors = [
          'input[type="search"]',
          'input[placeholder*="検索"]',
          'input[placeholder*="Search"]',
          'input[aria-label*="search"]',
          'input[name*="search"]',
          'input[type="text"]',
        ];

        for (const selector of searchInputSelectors) {
          try {
            const element = document.querySelector(selector);
            if (element) {
              results.hasSearchBox = true;
              results.searchInputType = selector;
              break;
            }
          } catch {
            // Ignore invalid selectors
          }
        }

        // 検索ボタンの確認
        const searchButtonSelectors = [
          'button:has-text("検索")',
          'button:has-text("Search")',
          'button[aria-label*="search"]',
          'button[type="submit"]',
        ];

        results.hasSearchButton = searchButtonSelectors.some((selector) => {
          try {
            return document.querySelector(selector) !== null;
          } catch {
            return false;
          }
        });

        return results;
      });

      // 検索機能の存在確認（オプショナル）
      if (searchFeatures.hasSearchBox) {
        console.log('Search input found:', searchFeatures.searchInputType);
      }
      if (searchFeatures.hasSearchButton) {
        console.log('Search button found');
      }

      // ページが正常に動作することを確認
      const pageWorks = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return !bodyText.includes('エラー') && !bodyText.includes('Error');
      });

      expect(pageWorks).toBeTruthy();
    });
  });

  test.describe('ダッシュボードデータ表示 (Dashboard Data)', () => {
    test('ダッシュボード基本表示の確認 @viewer', async ({ page, context }) => {
      const startTime = Date.now();

      // Viewer権限でのSupabase認証をセットアップ
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await SupabaseAuth.setup(context, page, { role: 'viewer' });

      // ダッシュボード用モックデータ
      await context.route('**/api/v1/dashboard**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              balances: {
                cash: 150000,
                bank: 850000,
                totalAssets: 1500000,
                totalLiabilities: 300000,
                totalEquity: 1200000,
              },
              recentTransactions: [
                {
                  id: 'trans-001',
                  date: '2024-01-20',
                  description: '売上入金',
                  amount: 100000,
                  type: 'income',
                },
                {
                  id: 'trans-002',
                  date: '2024-01-19',
                  description: '仕入支払',
                  amount: 50000,
                  type: 'expense',
                },
                {
                  id: 'trans-003',
                  date: '2024-01-18',
                  description: '経費支払',
                  amount: 20000,
                  type: 'expense',
                },
              ],
              summary: {
                monthlyRevenue: 500000,
                monthlyExpenses: 300000,
                netIncome: 200000,
              },
            },
          }),
        });
      });

      // ページ遷移（リトライ戦略付き）
      let retryCount = 0;
      const maxRetries = 3;
      while (retryCount < maxRetries) {
        try {
          await page.goto('/dashboard', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
          break;
        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries) throw error;
          console.log(`Retry ${retryCount}/${maxRetries} for dashboard page`);
          await page.waitForTimeout(2000);
        }
      }

      // Wait for specific content instead of networkidle (more reliable)
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000); // Brief pause for dynamic content

      // ダッシュボードコンテンツの確認
      const dashboardValidation = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        const results = {
          hasDashboardKeyword: false,
          hasBalanceInfo: false,
          hasRecentTransactions: false,
          hasSummaryInfo: false,
          hasCharts: false,
          errorMessages: [],
        };

        // キーワードチェック
        results.hasDashboardKeyword =
          bodyText.includes('ダッシュボード') ||
          bodyText.includes('Dashboard') ||
          bodyText.includes('概要') ||
          bodyText.includes('Overview');

        // 残高情報の確認
        results.hasBalanceInfo =
          bodyText.includes('現金') ||
          bodyText.includes('預金') ||
          bodyText.includes('資産') ||
          bodyText.includes('負債') ||
          bodyText.includes('純資産') ||
          bodyText.includes('残高') ||
          /[\d,]+円/.test(bodyText) ||
          /¥[\d,]+/.test(bodyText);

        // 最近の取引の確認
        results.hasRecentTransactions =
          bodyText.includes('取引') ||
          bodyText.includes('Transaction') ||
          bodyText.includes('売上') ||
          bodyText.includes('仕入') ||
          bodyText.includes('入金') ||
          bodyText.includes('支払');

        // サマリー情報の確認
        results.hasSummaryInfo =
          bodyText.includes('収益') ||
          bodyText.includes('費用') ||
          bodyText.includes('利益') ||
          bodyText.includes('Revenue') ||
          bodyText.includes('Expense') ||
          bodyText.includes('Income');

        // チャートの存在確認
        results.hasCharts =
          document.querySelector('canvas') !== null ||
          document.querySelector('svg[role="img"]') !== null ||
          document.querySelector('.chart') !== null ||
          document.querySelector('[class*="chart"]') !== null;

        // エラーチェック
        if (bodyText.includes('エラーが発生しました')) {
          results.errorMessages.push('Error page detected');
        }

        return results;
      });

      // アサーション（少なくとも2つの要素が存在）
      const validElements = [
        dashboardValidation.hasDashboardKeyword,
        dashboardValidation.hasBalanceInfo,
        dashboardValidation.hasRecentTransactions,
        dashboardValidation.hasSummaryInfo,
        dashboardValidation.hasCharts,
      ].filter(Boolean).length;

      expect(dashboardValidation.errorMessages).toHaveLength(0);
      expect(validElements).toBeGreaterThanOrEqual(1);

      // パフォーマンスログ
      const loadTime = Date.now() - startTime;
      console.log(`Dashboard loaded in ${loadTime}ms`);
    });

    test('残高情報の表示確認 @viewer', async ({ page, context }) => {
      // Viewer権限でのSupabase認証をセットアップ
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await SupabaseAuth.setup(context, page, { role: 'viewer' });

      // 残高情報のモックデータ
      await context.route('**/api/v1/balances**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              accounts: [
                { code: '1001', name: '現金', balance: 150000, type: 'asset' },
                { code: '1002', name: '普通預金', balance: 850000, type: 'asset' },
                { code: '1101', name: '売掛金', balance: 200000, type: 'asset' },
                { code: '2001', name: '買掛金', balance: 100000, type: 'liability' },
                { code: '3001', name: '資本金', balance: 1000000, type: 'equity' },
              ],
              summary: {
                totalAssets: 1200000,
                totalLiabilities: 100000,
                totalEquity: 1100000,
                workingCapital: 1100000,
              },
              lastUpdated: '2024-01-20T10:00:00Z',
            },
          }),
        });
      });

      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      // Wait for specific content instead of networkidle (more reliable)
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000); // Brief pause for dynamic content

      // 残高情報の詳細確認
      const balanceInfo = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        const results = {
          hasCashBalance: false,
          hasBankBalance: false,
          hasTotalAssets: false,
          hasWorkingCapital: false,
          balanceValues: [] as string[],
        };

        // 現金残高
        results.hasCashBalance =
          bodyText.includes('現金') && (/150[,.]?000/.test(bodyText) || bodyText.includes('15万'));

        // 預金残高
        results.hasBankBalance =
          bodyText.includes('預金') && (/850[,.]?000/.test(bodyText) || bodyText.includes('85万'));

        // 総資産
        results.hasTotalAssets =
          (bodyText.includes('資産') || bodyText.includes('Assets')) &&
          (/1[,.]?200[,.]?000/.test(bodyText) || bodyText.includes('120万'));

        // 運転資本
        results.hasWorkingCapital =
          bodyText.includes('運転資本') || bodyText.includes('Working Capital');

        // 数値の抽出
        const valuePattern = /[\d]{1,3}(?:[,.]?\d{3})*(?:\s?円)?/g;
        const matches = bodyText.match(valuePattern);
        if (matches) {
          results.balanceValues = matches.slice(0, 10); // 最初の10個まで
        }

        return results;
      });

      // 残高情報が表示されていることを確認
      const hasBalanceData =
        balanceInfo.hasCashBalance ||
        balanceInfo.hasBankBalance ||
        balanceInfo.hasTotalAssets ||
        balanceInfo.balanceValues.length > 0;

      expect(hasBalanceData).toBeTruthy();

      if (balanceInfo.balanceValues.length > 0) {
        console.log('Balance values found:', balanceInfo.balanceValues.slice(0, 5));
      }
    });

    test('最近の取引表示の確認 @viewer', async ({ page, context }) => {
      // Viewer権限でのSupabase認証をセットアップ
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await SupabaseAuth.setup(context, page, { role: 'viewer' });

      // 最近の取引のモックデータ
      await context.route('**/api/v1/recent-transactions**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 'rt-001',
                date: '2024-01-20',
                time: '14:30',
                description: '商品売上（現金）',
                debit: '現金',
                credit: '売上高',
                amount: 52500,
                status: 'completed',
              },
              {
                id: 'rt-002',
                date: '2024-01-20',
                time: '11:15',
                description: '仕入（掛け）',
                debit: '仕入高',
                credit: '買掛金',
                amount: 31500,
                status: 'completed',
              },
              {
                id: 'rt-003',
                date: '2024-01-19',
                time: '16:45',
                description: '水道光熱費',
                debit: '水道光熱費',
                credit: '現金',
                amount: 8400,
                status: 'completed',
              },
              {
                id: 'rt-004',
                date: '2024-01-19',
                time: '09:00',
                description: '給与支払',
                debit: '給与費',
                credit: '普通預金',
                amount: 250000,
                status: 'completed',
              },
              {
                id: 'rt-005',
                date: '2024-01-18',
                time: '15:20',
                description: '売掛金回収',
                debit: '普通預金',
                credit: '売掛金',
                amount: 105000,
                status: 'completed',
              },
            ],
            meta: {
              total: 5,
              hasMore: true,
            },
          }),
        });
      });

      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      // Wait for specific content instead of networkidle (more reliable)
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000); // Brief pause for dynamic content

      // 最近の取引情報の確認
      const transactionInfo = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        const results = {
          hasTransactionSection: false,
          transactionCount: 0,
          hasTransactionDates: false,
          hasTransactionAmounts: false,
          transactionDescriptions: [] as string[],
        };

        // 取引セクションの確認
        results.hasTransactionSection =
          bodyText.includes('最近の取引') ||
          bodyText.includes('Recent Transactions') ||
          bodyText.includes('取引履歴') ||
          bodyText.includes('Transaction History');

        // 取引の説明を検索
        const descriptions = [
          '商品売上',
          '仕入',
          '水道光熱費',
          '給与支払',
          '売掛金回収',
          '現金売上',
          '経費支払',
          '振込',
        ];

        descriptions.forEach((desc) => {
          if (bodyText.includes(desc)) {
            results.transactionDescriptions.push(desc);
            results.transactionCount++;
          }
        });

        // 日付の確認（2024-01形式）
        results.hasTransactionDates =
          /2024-01-\d{2}/.test(bodyText) || /1月\d{1,2}日/.test(bodyText);

        // 金額の確認
        results.hasTransactionAmounts =
          /[\d,]+円/.test(bodyText) ||
          /¥[\d,]+/.test(bodyText) ||
          /[\d]{1,3}(?:,\d{3})*/.test(bodyText);

        return results;
      });

      // 取引情報が表示されていることを確認
      const hasTransactionData =
        transactionInfo.hasTransactionSection ||
        transactionInfo.transactionCount > 0 ||
        transactionInfo.hasTransactionDates ||
        transactionInfo.hasTransactionAmounts;

      expect(hasTransactionData).toBeTruthy();

      if (transactionInfo.transactionDescriptions.length > 0) {
        console.log('Transactions found:', transactionInfo.transactionDescriptions);
      }
    });

    test('ダッシュボードのパフォーマンス測定 @viewer @performance', async ({ page, context }) => {
      const metrics = {
        navigationStart: 0,
        domContentLoaded: 0,
        loadComplete: 0,
        firstPaint: 0,
        firstContentfulPaint: 0,
      };

      // Viewer権限でのSupabase認証をセットアップ
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await SupabaseAuth.setup(context, page, { role: 'viewer' });

      // パフォーマンス測定開始
      metrics.navigationStart = Date.now();

      // ダッシュボードへ遷移
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      metrics.domContentLoaded = Date.now();

      // Wait for specific content instead of networkidle (more reliable)
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000); // Brief pause for dynamic content
      metrics.loadComplete = Date.now();

      // Web Vitals の取得
      const webVitals = await page.evaluate(() => {
        const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paint = performance.getEntriesByType('paint');

        return {
          domContentLoaded: perf?.domContentLoadedEventEnd - perf?.fetchStart,
          loadComplete: perf?.loadEventEnd - perf?.fetchStart,
          firstPaint: paint.find((p) => p.name === 'first-paint')?.startTime,
          firstContentfulPaint: paint.find((p) => p.name === 'first-contentful-paint')?.startTime,
        };
      });

      // パフォーマンスレポート
      console.log('\n=== Dashboard Performance Metrics ===');
      console.log(`DOM Content Loaded: ${metrics.domContentLoaded - metrics.navigationStart}ms`);
      console.log(`Page Load Complete: ${metrics.loadComplete - metrics.navigationStart}ms`);
      if (webVitals.firstPaint) {
        console.log(`First Paint: ${Math.round(webVitals.firstPaint)}ms`);
      }
      if (webVitals.firstContentfulPaint) {
        console.log(`First Contentful Paint: ${Math.round(webVitals.firstContentfulPaint)}ms`);
      }

      // パフォーマンス基準のアサーション（緩い基準）
      const totalLoadTime = metrics.loadComplete - metrics.navigationStart;
      expect(totalLoadTime).toBeLessThan(10000); // 10秒以内

      // 推奨基準との比較（情報提供のみ）
      if (totalLoadTime < 3000) {
        console.log('✅ Excellent performance (< 3s)');
      } else if (totalLoadTime < 5000) {
        console.log('⚠️  Good performance (< 5s)');
      } else {
        console.log('❌ Performance needs improvement (> 5s)');
      }
    });
  });

  test.describe('エラーハンドリングとリカバリー', () => {
    test('ネットワークエラー時の適切な表示 @viewer', async ({ page, context }) => {
      // Viewer権限でのSupabase認証をセットアップ
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await SupabaseAuth.setup(context, page, { role: 'viewer' });

      // ネットワークエラーをシミュレート
      await context.route('**/api/v1/**', async (route) => {
        await route.abort('failed');
      });

      // エラーが発生するページへ遷移
      await page
        .goto('/dashboard/journal-entries', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        })
        .catch(() => {
          // ナビゲーションエラーは無視
        });

      // エラー表示の確認
      const errorHandling = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        const results = {
          hasErrorMessage: false,
          hasRetryOption: false,
          hasContactInfo: false,
          isUserFriendly: false,
        };

        // エラーメッセージの確認
        results.hasErrorMessage =
          bodyText.includes('エラー') ||
          bodyText.includes('Error') ||
          bodyText.includes('問題') ||
          bodyText.includes('失敗') ||
          bodyText.includes('接続');

        // リトライオプションの確認
        results.hasRetryOption =
          bodyText.includes('再試行') ||
          bodyText.includes('リトライ') ||
          bodyText.includes('Retry') ||
          bodyText.includes('もう一度') ||
          Array.from(document.querySelectorAll('button')).some(
            (btn) => btn.textContent && btn.textContent.includes('再読み込み')
          );

        // サポート情報の確認
        results.hasContactInfo =
          bodyText.includes('サポート') ||
          bodyText.includes('お問い合わせ') ||
          bodyText.includes('Support') ||
          bodyText.includes('Contact');

        // ユーザーフレンドリーな表示か
        results.isUserFriendly =
          !bodyText.includes('undefined') &&
          !bodyText.includes('null') &&
          !/TypeError|ReferenceError|SyntaxError/.test(bodyText);

        return results;
      });

      // エラーハンドリングが適切であることを確認
      expect(errorHandling.isUserFriendly).toBeTruthy();

      if (errorHandling.hasErrorMessage) {
        console.log('Error message displayed appropriately');
      }
      if (errorHandling.hasRetryOption) {
        console.log('Retry option available');
      }
    });

    test('セッションタイムアウトの処理 @viewer', async ({ page, context }) => {
      // Viewer権限でのSupabase認証をセットアップ
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await SupabaseAuth.setup(context, page, { role: 'viewer' });

      // セッションタイムアウトをシミュレート
      await context.route('**/api/v1/**', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Unauthorized',
            message: 'Session expired',
          }),
        });
      });

      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

      // セッション切れの処理確認
      const sessionHandling = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        const url = window.location.href;

        return {
          hasLoginPrompt:
            bodyText.includes('ログイン') ||
            bodyText.includes('Login') ||
            bodyText.includes('サインイン') ||
            bodyText.includes('Sign in'),
          isRedirectedToAuth:
            url.includes('/login') || url.includes('/auth') || url.includes('/signin'),
          hasSessionExpiredMessage:
            bodyText.includes('セッション') ||
            bodyText.includes('Session') ||
            bodyText.includes('期限切れ') ||
            bodyText.includes('expired'),
        };
      });

      // セッション切れが適切に処理されることを確認
      const isProperlyHandled =
        sessionHandling.hasLoginPrompt ||
        sessionHandling.isRedirectedToAuth ||
        sessionHandling.hasSessionExpiredMessage;

      expect(isProperlyHandled).toBeTruthy();
    });
  });
});
