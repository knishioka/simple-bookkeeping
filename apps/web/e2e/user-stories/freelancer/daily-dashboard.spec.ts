/**
 * US001-S01: 朝一番の売上確認
 * 
 * ペルソナ: 田中さん（フリーランスデザイナー）
 * シナリオ: ダッシュボードで前日の売上と月次推移を確認
 */

import { storyTest, StoryTestHelper, storyExpect } from '../story-test-base';
import { userStories } from '../user-stories';

const story = userStories.find(s => s.id === 'US001')!;
const scenario = story.scenarios.find(s => s.id === 'US001-S01')!;

storyTest.describe('US001-S01: 朝一番の売上確認', () => {
  storyTest.beforeEach(async ({ page }) => {
    // テストデータのセットアップ
    await page.route('**/api/v1/dashboard/summary', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          data: {
            yesterday: {
              revenue: 150000,
              expenses: 30000,
              profit: 120000
            },
            monthToDate: {
              revenue: 2500000,
              expenses: 500000,
              profit: 2000000
            },
            yearOverYear: {
              revenue: { current: 2500000, previous: 2000000, growth: 25 },
              profit: { current: 2000000, previous: 1500000, growth: 33.3 }
            }
          }
        }
      });
    });
  });

  storyTest('田中さんの朝のルーティン', async ({ page, recordStep }) => {
    // ステップ1: ダッシュボードにアクセス
    await StoryTestHelper.executeStep(
      page,
      'ダッシュボードにアクセス',
      async () => {
        await page.goto('/dashboard');
        await page.waitForSelector('h1:has-text("ダッシュボード")');
      },
      recordStep
    );

    // 受け入れ条件: 3秒以内に表示
    await StoryTestHelper.verifyAcceptanceCriteria(
      page,
      'ダッシュボードが3秒以内に表示される',
      async () => {
        const loadTime = await storyExpect.toCompleteWithin(
          async () => {
            await page.reload();
            await page.waitForLoadState('networkidle');
          },
          3000
        );
        console.log(`実際のロード時間: ${loadTime.duration}ms`);
      }
    );

    // ステップ2: 前日の売上高を確認
    await StoryTestHelper.executeStep(
      page,
      '前日の売上高を確認',
      async () => {
        const revenueCard = page.locator('.dashboard-card:has-text("昨日の売上")');
        await revenueCard.waitFor();
        
        const revenue = await revenueCard.locator('.amount').textContent();
        storyTest.expect(revenue).toContain('150,000');
        
        // 田中さんの期待: 見やすい表示
        await storyTest.expect(revenueCard).toBeVisible();
        const fontSize = await revenueCard.locator('.amount').evaluate(
          el => window.getComputedStyle(el).fontSize
        );
        storyTest.expect(parseInt(fontSize)).toBeGreaterThan(20);
      },
      recordStep
    );

    // ステップ3: 月累計売上を確認
    await StoryTestHelper.executeStep(
      page,
      '月累計売上を確認',
      async () => {
        const monthlyCard = page.locator('.dashboard-card:has-text("今月の売上")');
        await monthlyCard.waitFor();
        
        const monthlyRevenue = await monthlyCard.locator('.amount').textContent();
        storyTest.expect(monthlyRevenue).toContain('2,500,000');
        
        // 利益率も表示されているか
        const profitMargin = await monthlyCard.locator('.profit-margin').textContent();
        storyTest.expect(profitMargin).toContain('80%'); // 2M/2.5M = 80%
      },
      recordStep
    );

    // ステップ4: 前年同月比を確認
    await StoryTestHelper.executeStep(
      page,
      '前年同月比を確認',
      async () => {
        const yoyCard = page.locator('.dashboard-card:has-text("前年同月比")');
        await yoyCard.waitFor();
        
        const growth = await yoyCard.locator('.growth-rate').textContent();
        storyTest.expect(growth).toContain('+25%');
        
        // 視覚的にわかりやすい色分け
        const growthColor = await yoyCard.locator('.growth-rate').evaluate(
          el => window.getComputedStyle(el).color
        );
        // 緑系の色（成長はポジティブ）
        storyTest.expect(growthColor).toMatch(/rgb\(.*[0-9]+.*,.*[1-9][0-9]+.*,/);
      },
      recordStep
    );

    // 追加の検証: モバイルでも使いやすいか
    await StoryTestHelper.verifyAcceptanceCriteria(
      page,
      'スマホでも問題なく表示される',
      async () => {
        // iPhoneサイズに変更
        await page.setViewportSize({ width: 390, height: 844 });
        
        // すべてのカードが縦に並んで表示されるか
        const cards = await page.locator('.dashboard-card').all();
        let previousBottom = 0;
        
        for (const card of cards) {
          const box = await card.boundingBox();
          if (box && previousBottom > 0) {
            // 前のカードの下に配置されている
            storyTest.expect(box.y).toBeGreaterThan(previousBottom);
          }
          if (box) previousBottom = box.y + box.height;
        }
      }
    );

    // 田中さんの満足度チェック
    await StoryTestHelper.verifyAcceptanceCriteria(
      page,
      '必要な情報が一目でわかる',
      async () => {
        // スクロールなしで主要情報が見える
        const viewport = page.viewportSize()!;
        const importantElements = [
          '.dashboard-card:has-text("昨日の売上")',
          '.dashboard-card:has-text("今月の売上")',
          '.dashboard-card:has-text("前年同月比")'
        ];
        
        for (const selector of importantElements) {
          const box = await page.locator(selector).boundingBox();
          storyTest.expect(box).not.toBeNull();
          if (box) {
            storyTest.expect(box.y + box.height).toBeLessThan(viewport.height);
          }
        }
      }
    );
  });

  storyTest('グラフでの視覚的な確認', async ({ page, recordStep }) => {
    await page.goto('/dashboard');

    await StoryTestHelper.executeStep(
      page,
      '売上推移グラフを確認',
      async () => {
        const chartSection = page.locator('.revenue-chart-section');
        await chartSection.waitFor();
        
        // グラフが表示されている
        const chart = chartSection.locator('canvas, svg');
        await storyTest.expect(chart).toBeVisible();
        
        // 期間切り替えができる
        const periodSelector = chartSection.locator('button:has-text("期間")');
        await periodSelector.click();
        
        const options = ['1週間', '1ヶ月', '3ヶ月', '1年'];
        for (const option of options) {
          await storyTest.expect(page.locator(`text="${option}"`)).toBeVisible();
        }
      },
      recordStep
    );
  });
});