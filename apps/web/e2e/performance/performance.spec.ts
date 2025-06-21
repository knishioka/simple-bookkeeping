import { test, expect } from '@playwright/test';

/**
 * パフォーマンステスト
 * 
 * アプリケーションの応答速度、大量データ処理、
 * メモリ使用量などをテストします。
 */

test.describe('パフォーマンステスト', () => {
  test.describe('ページロード速度', () => {
    test('初回ロード時間の測定', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/demo');
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // 3秒以内にロード完了
      expect(loadTime).toBeLessThan(3000);
      
      // Core Web Vitalsの測定
      const metrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const fcp = entries.find(e => e.name === 'first-contentful-paint');
            const lcp = entries.find(e => e.entryType === 'largest-contentful-paint');
            
            resolve({
              fcp: fcp?.startTime,
              lcp: lcp?.startTime,
            });
          });
          
          observer.observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
          
          // タイムアウト
          setTimeout(() => resolve({}), 5000);
        });
      });
      
      console.log('Performance metrics:', metrics);
      
      // FCP（First Contentful Paint）は1.8秒以内
      if (metrics.fcp) {
        expect(metrics.fcp).toBeLessThan(1800);
      }
    });

    test('キャッシュ利用時のロード速度', async ({ page }) => {
      // 初回アクセス
      await page.goto('/demo');
      await page.waitForLoadState('networkidle');
      
      // 2回目のアクセス（キャッシュ利用）
      const startTime = Date.now();
      await page.reload();
      await page.waitForLoadState('networkidle');
      const cachedLoadTime = Date.now() - startTime;
      
      // キャッシュ利用時は1秒以内
      expect(cachedLoadTime).toBeLessThan(1000);
    });
  });

  test.describe('大量データ処理', () => {
    test('1000件の仕訳データ表示', async ({ page }) => {
      // 大量データのモックを設定
      await page.route('**/api/v1/journal-entries*', async (route) => {
        const entries = Array.from({ length: 1000 }, (_, i) => ({
          id: `entry-${i}`,
          entryNumber: `2024030${String(i).padStart(3, '0')}`,
          entryDate: '2024-03-01',
          description: `テスト仕訳 ${i}`,
          status: 'APPROVED',
          totalAmount: 10000 + i * 100,
          lines: [
            {
              id: `line-${i}-1`,
              accountId: '1',
              account: { id: '1', code: '1110', name: '現金' },
              debitAmount: 10000 + i * 100,
              creditAmount: 0,
            },
            {
              id: `line-${i}-2`,
              accountId: '2',
              account: { id: '2', code: '4110', name: '売上高' },
              debitAmount: 0,
              creditAmount: 10000 + i * 100,
            },
          ],
        }));
        
        await route.fulfill({
          status: 200,
          json: { data: entries },
        });
      });
      
      const startTime = Date.now();
      await page.goto('/demo/journal-entries');
      
      // テーブルが表示されるまで待機
      await page.waitForSelector('table tbody tr');
      
      const renderTime = Date.now() - startTime;
      
      // 1000件でも5秒以内に表示
      expect(renderTime).toBeLessThan(5000);
      
      // スクロールパフォーマンス
      const scrollStartTime = Date.now();
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      const scrollTime = Date.now() - scrollStartTime;
      
      // スムーズなスクロール（100ms以内）
      expect(scrollTime).toBeLessThan(100);
    });

    test('複雑な集計レポートの生成', async ({ page }) => {
      // 集計データのモック
      await page.route('**/api/v1/reports/trial-balance*', async (route) => {
        const accounts = Array.from({ length: 200 }, (_, i) => ({
          id: `account-${i}`,
          code: `${1000 + i}`,
          name: `勘定科目${i}`,
          accountType: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'][i % 5],
          balance: {
            debit: Math.random() * 1000000,
            credit: Math.random() * 1000000,
          },
        }));
        
        await route.fulfill({
          status: 200,
          json: { data: accounts },
        });
      });
      
      const startTime = Date.now();
      await page.goto('/demo/reports/trial-balance');
      
      // レポートが表示されるまで待機
      await page.waitForSelector('table');
      
      const reportTime = Date.now() - startTime;
      
      // 複雑なレポートでも3秒以内
      expect(reportTime).toBeLessThan(3000);
    });
  });

  test.describe('メモリ使用量', () => {
    test('長時間使用でのメモリリーク検出', async ({ page }) => {
      // メモリ使用量の初期値を取得
      const getMemoryUsage = async () => {
        return await page.evaluate(() => {
          if ('memory' in performance) {
            return (performance as any).memory.usedJSHeapSize;
          }
          return 0;
        });
      };
      
      await page.goto('/demo/journal-entries');
      const initialMemory = await getMemoryUsage();
      
      // 繰り返し操作を実行
      for (let i = 0; i < 10; i++) {
        // ダイアログを開いて閉じる
        await page.click('text=新規作成');
        await page.waitForSelector('[role="dialog"]');
        await page.click('button:has-text("キャンセル")');
        await page.waitForSelector('[role="dialog"]', { state: 'hidden' });
      }
      
      // ガベージコレクションを強制実行（可能な場合）
      await page.evaluate(() => {
        if (window.gc) {
          window.gc();
        }
      });
      
      await page.waitForTimeout(1000);
      const finalMemory = await getMemoryUsage();
      
      // メモリ増加量が50MB以内
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
      console.log(`Memory increase: ${memoryIncrease.toFixed(2)} MB`);
      expect(memoryIncrease).toBeLessThan(50);
    });
  });

  test.describe('API応答速度', () => {
    test('並列APIリクエストの処理', async ({ page }) => {
      let requestCount = 0;
      const requestTimes: number[] = [];
      
      // APIリクエストを監視
      page.on('request', (request) => {
        if (request.url().includes('/api/v1/')) {
          requestCount++;
          requestTimes.push(Date.now());
        }
      });
      
      page.on('response', (response) => {
        if (response.url().includes('/api/v1/')) {
          const responseTime = Date.now() - requestTimes.shift()!;
          console.log(`API response time: ${responseTime}ms`);
          
          // 各APIリクエストは1秒以内に応答
          expect(responseTime).toBeLessThan(1000);
        }
      });
      
      // 複数のAPIを同時に呼び出すページ
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // 複数のAPIが並列で呼ばれることを確認
      expect(requestCount).toBeGreaterThan(2);
    });

    test('検索のレスポンシブ性', async ({ page }) => {
      await page.goto('/demo/accounts');
      
      const searchInput = page.locator('input[placeholder*="検索"]');
      
      // 高速タイピングのシミュレーション
      const searchTerm = 'テスト勘定科目';
      let lastRequestTime = 0;
      
      page.on('request', (request) => {
        if (request.url().includes('search=')) {
          const now = Date.now();
          if (lastRequestTime > 0) {
            const debounceTime = now - lastRequestTime;
            // デバウンスが効いていることを確認（最低300ms）
            expect(debounceTime).toBeGreaterThan(300);
          }
          lastRequestTime = now;
        }
      });
      
      // 1文字ずつ高速入力
      for (const char of searchTerm) {
        await searchInput.type(char);
        await page.waitForTimeout(50); // 50msごとに入力
      }
      
      // 最後の検索結果が表示されるまで待機
      await page.waitForResponse(response => 
        response.url().includes('search=') && response.status() === 200
      );
    });
  });

  test.describe('ブラウザリソース使用', () => {
    test('複雑なフォームでのCPU使用率', async ({ page }) => {
      await page.goto('/demo/journal-entries');
      await page.click('text=新規作成');
      
      // CPU使用率の測定（Chrome DevTools Protocol使用）
      const client = await page.context().newCDPSession(page);
      await client.send('Performance.enable');
      
      const startMetrics = await client.send('Performance.getMetrics');
      const startTime = startMetrics.metrics.find(m => m.name === 'Timestamp')?.value || 0;
      
      // 複雑な操作を実行
      for (let i = 0; i < 5; i++) {
        await page.click('button:has-text("行を追加")');
      }
      
      // 各行に入力
      const selects = page.locator('[role="combobox"]');
      const selectCount = await selects.count();
      
      for (let i = 0; i < Math.min(selectCount, 10); i++) {
        await selects.nth(i).click();
        await page.click('[role="option"]').first();
      }
      
      const endMetrics = await client.send('Performance.getMetrics');
      const endTime = endMetrics.metrics.find(m => m.name === 'Timestamp')?.value || 0;
      const duration = endTime - startTime;
      
      const taskDuration = endMetrics.metrics.find(m => m.name === 'TaskDuration')?.value || 0;
      const cpuUsage = (taskDuration / duration) * 100;
      
      console.log(`CPU usage: ${cpuUsage.toFixed(2)}%`);
      
      // CPU使用率が50%以下
      expect(cpuUsage).toBeLessThan(50);
    });
  });
});