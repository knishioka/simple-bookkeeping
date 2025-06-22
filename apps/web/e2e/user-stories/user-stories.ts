/**
 * ユーザーストーリー定義
 *
 * 各ストーリーにはID、ペルソナ、シナリオ、受け入れ条件を定義
 */

export interface UserStory {
  id: string;
  title: string;
  persona: {
    name: string;
    role: string;
    background: string;
  };
  scenarios: Scenario[];
  acceptanceCriteria: string[];
  priority: 'high' | 'medium' | 'low';
  status: 'not-started' | 'in-progress' | 'completed';
}

export interface Scenario {
  id: string;
  description: string;
  steps: string[];
  testFiles?: string[]; // 関連するテストファイル
}

export const userStories: UserStory[] = [
  {
    id: 'US001',
    title: '個人事業主の日次経理業務',
    persona: {
      name: '田中さん',
      role: 'フリーランスデザイナー',
      background: '独立2年目、Excel管理から移行',
    },
    scenarios: [
      {
        id: 'US001-S01',
        description: '朝一番の売上確認',
        steps: [
          'ダッシュボードにアクセス',
          '前日の売上高を確認',
          '月累計売上を確認',
          '前年同月比を確認',
        ],
        testFiles: ['e2e/user-stories/freelancer/daily-dashboard.spec.ts'],
      },
      {
        id: 'US001-S02',
        description: 'クライアントからの入金処理',
        steps: [
          '仕訳入力画面を開く',
          '日付に入金日を設定',
          '借方：普通預金 100,000円',
          '貸方：売掛金 100,000円',
          '摘要：〇〇デザイン料入金',
          '保存して仕訳一覧で確認',
        ],
        testFiles: ['e2e/user-stories/freelancer/payment-entry.spec.ts'],
      },
      {
        id: 'US001-S03',
        description: '経費入力（領収書ベース）',
        steps: [
          'スマホで仕訳入力画面にアクセス',
          '日付を選択',
          '借方：消耗品費を選択',
          '金額：3,000円を入力',
          '貸方：現金を選択',
          '摘要：文房具購入',
          '保存',
        ],
        testFiles: ['e2e/user-stories/freelancer/expense-entry-mobile.spec.ts'],
      },
    ],
    acceptanceCriteria: [
      'ダッシュボードが3秒以内に表示される',
      '仕訳入力が1分以内に完了できる',
      'スマホでも問題なく入力できる',
      '入力ミスを防ぐバリデーションが機能する',
    ],
    priority: 'high',
    status: 'not-started',
  },
  {
    id: 'US002',
    title: '小規模店舗の日次売上管理',
    persona: {
      name: '佐藤さん',
      role: 'カフェオーナー',
      background: '夫婦で経営、5席の小さなカフェ',
    },
    scenarios: [
      {
        id: 'US002-S01',
        description: '開店前のレジ現金確認と前日売上入力',
        steps: [
          '現金残高確認画面を開く',
          '実際の現金を数える',
          'システム上の残高と照合',
          '差異があれば調整仕訳を入力',
          '前日の売上仕訳を入力',
        ],
        testFiles: ['e2e/user-stories/cafe/cash-reconciliation.spec.ts'],
      },
      {
        id: 'US002-S02',
        description: '仕入れ業者への支払い記録',
        steps: [
          '買掛金一覧を開く',
          '支払い対象の仕入先を選択',
          '支払い仕訳を入力',
          '買掛金残高が減少することを確認',
        ],
        testFiles: ['e2e/user-stories/cafe/supplier-payment.spec.ts'],
      },
    ],
    acceptanceCriteria: [
      '現金残高が常に正確に把握できる',
      '買掛金の支払い漏れを防げる',
      '日次の売上集計が簡単にできる',
    ],
    priority: 'high',
    status: 'not-started',
  },
  {
    id: 'US003',
    title: '中小企業の月次決算業務',
    persona: {
      name: '山田さん',
      role: '経理担当',
      background: '従業員30名の製造業',
    },
    scenarios: [
      {
        id: 'US003-S01',
        description: '月初の前月仕訳レビュー',
        steps: [
          '前月の仕訳一覧を表示',
          '未承認仕訳をフィルタ',
          '各仕訳の内容を確認',
          '問題なければ承認',
          '修正が必要なら編集',
        ],
        testFiles: ['e2e/user-stories/sme/monthly-review.spec.ts'],
      },
      {
        id: 'US003-S02',
        description: '試算表作成と分析',
        steps: [
          'レポートメニューから試算表を選択',
          '対象期間を設定',
          '試算表を生成',
          '前月比較を表示',
          '異常値をチェック',
          'PDFエクスポート',
        ],
        testFiles: ['e2e/user-stories/sme/trial-balance-report.spec.ts'],
      },
    ],
    acceptanceCriteria: [
      '月次決算が5営業日以内に完了できる',
      '試算表の自動生成ができる',
      '前期比較が簡単にできる',
      '役員向けレポートが作成できる',
    ],
    priority: 'medium',
    status: 'not-started',
  },
];

/**
 * ストーリーIDからテストファイルを取得
 */
export function getTestFilesForStory(storyId: string): string[] {
  const story = userStories.find((s) => s.id === storyId);
  if (!story) return [];

  return story.scenarios.flatMap((s) => s.testFiles || []);
}

/**
 * テストファイルから関連するストーリーを取得
 */
export function getStoriesForTestFile(testFile: string): UserStory[] {
  return userStories.filter((story) =>
    story.scenarios.some((scenario) => scenario.testFiles?.includes(testFile))
  );
}
