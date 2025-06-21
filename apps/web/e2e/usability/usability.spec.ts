import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * ユーザビリティテスト
 * 
 * キーボード操作、アクセシビリティ、
 * ユーザー体験の向上をテストします。
 */

test.describe('ユーザビリティテスト', () => {
  test.describe('キーボードナビゲーション', () => {
    test('キーボードのみで仕訳入力が完了できる', async ({ page }) => {
      await page.goto('/demo/journal-entries');
      
      // Tabキーで新規作成ボタンにフォーカス
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab'); // ヘッダーをスキップ
      
      // Enterで新規作成ダイアログを開く
      await page.keyboard.press('Enter');
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      
      // Tab順序でフォーム要素を移動
      await page.keyboard.press('Tab'); // 日付（デフォルトで今日）
      await page.keyboard.press('Tab'); // 摘要
      await page.keyboard.type('キーボードテスト仕訳');
      
      // 勘定科目選択（1行目）
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter'); // Selectを開く
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter'); // 選択
      
      // 借方金額
      await page.keyboard.press('Tab');
      await page.keyboard.type('50000');
      
      // 貸方金額（スキップ）
      await page.keyboard.press('Tab');
      
      // 明細摘要（スキップ）
      await page.keyboard.press('Tab');
      
      // 税率（スキップ）
      await page.keyboard.press('Tab');
      
      // 2行目の勘定科目
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await page.keyboard.type('売上'); // 検索
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      
      // 借方金額（スキップ）
      await page.keyboard.press('Tab');
      
      // 貸方金額
      await page.keyboard.press('Tab');
      await page.keyboard.type('50000');
      
      // 作成ボタンまでTab
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
      }
      
      // Enterで保存
      await page.keyboard.press('Enter');
      
      await expect(page.locator('text=仕訳を作成しました')).toBeVisible();
    });

    test('モーダル内でのフォーカストラップ', async ({ page }) => {
      await page.goto('/demo/accounts');
      await page.click('text=新規作成');
      
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
      
      // 最後の要素からTabを押すと最初に戻る
      const lastButton = dialog.locator('button').last();
      await lastButton.focus();
      await page.keyboard.press('Tab');
      
      // フォーカスがダイアログ内の最初の入力要素に戻る
      await expect(dialog.locator('input').first()).toBeFocused();
      
      // Shift+Tabで逆方向
      await page.keyboard.press('Shift+Tab');
      await expect(lastButton).toBeFocused();
      
      // Escapeでダイアログを閉じる
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
    });

    test('ショートカットキーの動作', async ({ page }) => {
      await page.goto('/dashboard');
      
      // グローバルショートカット
      // Cmd/Ctrl + K で検索
      await page.keyboard.press('Meta+k');
      const searchModal = page.locator('[role="dialog"]:has-text("検索")');
      await expect(searchModal).toBeVisible();
      await page.keyboard.press('Escape');
      
      // Cmd/Ctrl + N で新規作成
      await page.goto('/dashboard/journal-entries');
      await page.keyboard.press('Meta+n');
      await expect(page.locator('[role="dialog"]:has-text("仕訳の新規作成")')).toBeVisible();
      await page.keyboard.press('Escape');
      
      // ? でヘルプ
      await page.keyboard.press('?');
      await expect(page.locator('[role="dialog"]:has-text("キーボードショートカット")')).toBeVisible();
    });
  });

  test.describe('アクセシビリティ', () => {
    test('WCAG 2.1 AA準拠の確認', async ({ page }) => {
      await page.goto('/demo');
      
      // axe-coreによる自動テスト
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      
      // 違反がないことを確認
      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('スクリーンリーダーのランドマーク', async ({ page }) => {
      await page.goto('/dashboard');
      
      // 主要なランドマークが存在
      await expect(page.locator('nav[aria-label="メインナビゲーション"]')).toBeVisible();
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('header')).toBeVisible();
      
      // 適切な見出し階層
      const h1 = await page.locator('h1').count();
      expect(h1).toBe(1); // h1は1つのみ
      
      // スキップリンク
      await page.keyboard.press('Tab');
      const skipLink = page.locator('text=メインコンテンツへスキップ');
      if (await skipLink.isVisible()) {
        await skipLink.click();
        await expect(page.locator('main')).toBeFocused();
      }
    });

    test('フォーム要素のラベル付け', async ({ page }) => {
      await page.goto('/demo/accounts');
      await page.click('text=新規作成');
      
      const dialog = page.locator('[role="dialog"]');
      
      // すべての入力要素にラベルがある
      const inputs = dialog.locator('input, select, textarea');
      const inputCount = await inputs.count();
      
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const inputId = await input.getAttribute('id');
        
        if (inputId) {
          // 対応するラベルが存在
          const label = dialog.locator(`label[for="${inputId}"]`);
          await expect(label).toHaveCount(1);
        } else {
          // aria-labelまたはaria-labelledbyが存在
          const ariaLabel = await input.getAttribute('aria-label');
          const ariaLabelledby = await input.getAttribute('aria-labelledby');
          expect(ariaLabel || ariaLabelledby).toBeTruthy();
        }
      }
    });

    test('色のコントラスト比', async ({ page }) => {
      await page.goto('/demo');
      
      // 色のコントラストをチェック
      const contrastResults = await new AxeBuilder({ page })
        .withTags(['color-contrast'])
        .analyze();
      
      expect(contrastResults.violations).toEqual([]);
      
      // ダークモードでも確認
      await page.click('button[aria-label="テーマ切り替え"]');
      await page.waitForTimeout(500); // アニメーション待機
      
      const darkModeResults = await new AxeBuilder({ page })
        .withTags(['color-contrast'])
        .analyze();
      
      expect(darkModeResults.violations).toEqual([]);
    });
  });

  test.describe('フォーカス管理', () => {
    test('フォーカスの可視性', async ({ page }) => {
      await page.goto('/demo');
      
      // キーボードナビゲーション時のフォーカスリング
      await page.keyboard.press('Tab');
      
      // フォーカスされた要素を取得
      const focusedElement = page.locator(':focus');
      
      // フォーカスリングのスタイルを確認
      const outline = await focusedElement.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return {
          outlineWidth: styles.outlineWidth,
          outlineStyle: styles.outlineStyle,
          outlineColor: styles.outlineColor,
        };
      });
      
      // 可視のアウトラインがある
      expect(parseInt(outline.outlineWidth)).toBeGreaterThan(0);
      expect(outline.outlineStyle).not.toBe('none');
    });

    test('エラー時のフォーカス移動', async ({ page }) => {
      await page.goto('/demo/accounts');
      await page.click('text=新規作成');
      
      const dialog = page.locator('[role="dialog"]');
      
      // 空のフォームを送信
      await dialog.locator('button:has-text("作成")').click();
      
      // エラーがある最初のフィールドにフォーカス
      await expect(dialog.locator('input[name="code"]')).toBeFocused();
      
      // エラーメッセージがaria-liveで読み上げられる
      const errorRegion = page.locator('[aria-live="polite"], [aria-live="assertive"]');
      await expect(errorRegion).toContainText('必須');
    });
  });

  test.describe('レスポンシブデザイン', () => {
    test('モバイルでのタッチ操作', async ({ page }) => {
      // iPhone 12のビューポート
      await page.setViewportSize({ width: 390, height: 844 });
      
      await page.goto('/demo/journal-entries');
      
      // ハンバーガーメニューが表示される
      const hamburger = page.locator('button[aria-label="メニュー"]');
      await expect(hamburger).toBeVisible();
      
      // メニューを開く
      await hamburger.tap();
      const mobileMenu = page.locator('nav[aria-label="モバイルメニュー"]');
      await expect(mobileMenu).toBeVisible();
      
      // スワイプジェスチャーでメニューを閉じる
      await page.locator('body').swipe({
        startPosition: { x: 200, y: 400 },
        endPosition: { x: 50, y: 400 },
      });
      await expect(mobileMenu).not.toBeVisible();
      
      // テーブルの横スクロール
      const table = page.locator('table');
      await expect(table).toBeVisible();
      
      // テーブルコンテナーがスクロール可能
      const tableContainer = table.locator('..');
      const overflow = await tableContainer.evaluate((el) => {
        return window.getComputedStyle(el).overflowX;
      });
      expect(overflow).toBe('auto');
    });

    test('タブレットでの操作', async ({ page }) => {
      // iPad Airのビューポート
      await page.setViewportSize({ width: 820, height: 1180 });
      
      await page.goto('/dashboard');
      
      // サイドバーが表示される（タブレットでは固定）
      await expect(page.locator('aside')).toBeVisible();
      
      // グリッドレイアウトの確認
      const cards = page.locator('.grid > .card');
      const firstCard = cards.first();
      const secondCard = cards.nth(1);
      
      // 2カラムレイアウト
      const firstBox = await firstCard.boundingBox();
      const secondBox = await secondCard.boundingBox();
      
      if (firstBox && secondBox) {
        expect(secondBox.x).toBeGreaterThan(firstBox.x + firstBox.width);
        expect(Math.abs(firstBox.y - secondBox.y)).toBeLessThan(5);
      }
    });
  });

  test.describe('ユーザーガイダンス', () => {
    test('初回利用時のツアー', async ({ page }) => {
      // 初回アクセスをシミュレート
      await page.goto('/dashboard?firstTime=true');
      
      // ウェルカムモーダル
      const welcomeModal = page.locator('[role="dialog"]:has-text("ようこそ")');
      await expect(welcomeModal).toBeVisible();
      
      // ツアー開始
      await welcomeModal.locator('button:has-text("ツアーを開始")').click();
      
      // ステップ1: ダッシュボード説明
      const tourPopover = page.locator('[role="tooltip"], [data-tour-step]');
      await expect(tourPopover).toContainText('ダッシュボード');
      
      // 次へ
      await tourPopover.locator('button:has-text("次へ")').click();
      
      // ステップ2: ナビゲーション説明
      await expect(tourPopover).toContainText('メニュー');
      
      // スキップ可能
      const skipButton = tourPopover.locator('button:has-text("スキップ")');
      await expect(skipButton).toBeVisible();
    });

    test('コンテキストヘルプ', async ({ page }) => {
      await page.goto('/demo/journal-entries');
      await page.click('text=新規作成');
      
      const dialog = page.locator('[role="dialog"]');
      
      // ヘルプアイコンがある
      const helpIcons = dialog.locator('[aria-label*="ヘルプ"]');
      const helpCount = await helpIcons.count();
      expect(helpCount).toBeGreaterThan(0);
      
      // ヘルプをホバー/クリック
      await helpIcons.first().hover();
      
      // ツールチップが表示される
      const tooltip = page.locator('[role="tooltip"]');
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toContainText('説明');
    });
  });

  test.describe('パフォーマンス改善のUX', () => {
    test('遅延ロード時のスケルトン表示', async ({ page }) => {
      // 遅いAPIレスポンスをシミュレート
      await page.route('**/api/v1/journal-entries', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await route.fulfill({
          status: 200,
          json: { data: [] },
        });
      });
      
      await page.goto('/demo/journal-entries');
      
      // スケルトンローダーが表示される
      const skeleton = page.locator('[data-testid="skeleton"], .skeleton');
      await expect(skeleton.first()).toBeVisible();
      
      // データロード後はスケルトンが消える
      await expect(skeleton.first()).not.toBeVisible({ timeout: 5000 });
    });

    test('楽観的UIアップデート', async ({ page }) => {
      await page.goto('/demo/accounts');
      
      // 削除操作
      const firstRow = page.locator('table tbody tr').first();
      const accountName = await firstRow.locator('td').nth(1).textContent();
      
      await firstRow.locator('button[aria-label="削除"]').click();
      
      // 確認ダイアログ
      await page.locator('button:has-text("削除する")').click();
      
      // 即座にUIから削除される（楽観的更新）
      await expect(firstRow).not.toBeVisible();
      
      // エラーが発生した場合は元に戻る
      // （この例では成功するが、エラー時の処理も重要）
    });
  });
});