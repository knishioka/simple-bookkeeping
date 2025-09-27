/**
 * ユーザーストーリーカバレッジレポート生成
 *
 * 各ストーリーのテスト実装状況を可視化
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

import { userStories } from './user-stories';

interface TestSuite {
  file?: string;
  specs?: Array<{
    title: string;
    tests?: Array<{
      title: string;
      results?: Array<{
        status: string;
        error?: unknown;
      }>;
    }>;
  }>;
}

interface TestResults {
  suites?: TestSuite[];
}

interface Scenario {
  id: string;
  title?: string;
  description?: string;
  testFiles?: string[];
}

interface UserStory {
  id: string;
  title: string;
  scenarios: Scenario[];
}

interface TestResult {
  storyId: string;
  scenarioId: string;
  testFile: string;
  status: 'passed' | 'failed' | 'skipped' | 'not-implemented';
  duration?: number;
  failureReason?: string;
}

interface CoverageReport {
  totalStories: number;
  implementedStories: number;
  totalScenarios: number;
  implementedScenarios: number;
  testResults: TestResult[];
  coveragePercentage: number;
  lastUpdated: Date;
}

export class StoryCoverageReporter {
  /**
   * Playwrightのテスト結果からカバレッジレポートを生成
   */
  static async generateReport(testResultsPath: string): Promise<CoverageReport> {
    const testResults: TestResult[] = [];
    let implementedStories = 0;
    let implementedScenarios = 0;

    for (const story of userStories) {
      let storyHasTests = false;

      for (const scenario of story.scenarios) {
        if (scenario.testFiles && scenario.testFiles.length > 0) {
          let scenarioHasTests = false;

          for (const testFile of scenario.testFiles) {
            const testPath = join(__dirname, '..', '..', testFile);
            // eslint-disable-next-line security/detect-non-literal-fs-filename -- test file paths are from config
            const exists = existsSync(testPath);

            if (exists) {
              scenarioHasTests = true;
              storyHasTests = true;

              // テスト結果を読み取る（Playwright の reporter 出力から）
              const result = await this.getTestResult(testFile, testResultsPath);
              testResults.push({
                storyId: story.id,
                scenarioId: scenario.id,
                testFile,
                status: result.status,
                duration: result.duration,
                failureReason: result.failureReason,
              });
            } else {
              testResults.push({
                storyId: story.id,
                scenarioId: scenario.id,
                testFile,
                status: 'not-implemented',
              });
            }
          }

          if (scenarioHasTests) {
            implementedScenarios++;
          }
        }
      }

      if (storyHasTests) {
        implementedStories++;
      }
    }

    const totalStories = userStories.length;
    const totalScenarios = userStories.reduce((sum, story) => sum + story.scenarios.length, 0);
    const coveragePercentage = (implementedScenarios / totalScenarios) * 100;

    return {
      totalStories,
      implementedStories,
      totalScenarios,
      implementedScenarios,
      testResults,
      coveragePercentage,
      lastUpdated: new Date(),
    };
  }

  /**
   * 個別のテスト結果を取得
   */
  private static async getTestResult(
    testFile: string,
    testResultsPath: string
  ): Promise<{ status: TestResult['status']; duration?: number; failureReason?: string }> {
    // Playwright の JSON reporter 出力を読み取る
    try {
      const resultsFile = join(testResultsPath, 'results.json');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test results path is controlled
      if (existsSync(resultsFile)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- test results path is validated above
        const results: TestResults = JSON.parse(readFileSync(resultsFile, 'utf-8'));

        // テストファイルに対応する結果を探す
        const testResult = results.suites?.find((suite: TestSuite) =>
          suite.file?.includes(testFile.replace('e2e/', ''))
        );

        if (testResult) {
          const status = testResult.specs?.[0]?.tests?.[0]?.status || 'skipped';
          const duration = testResult.specs?.[0]?.tests?.[0]?.duration;
          const failureReason = testResult.specs?.[0]?.tests?.[0]?.error?.message;

          return { status, duration, failureReason };
        }
      }
    } catch (error) {
      console.error(`Failed to read test results for ${testFile}:`, error);
    }

    return { status: 'skipped' };
  }

  /**
   * HTML形式のカバレッジレポートを生成
   */
  static generateHTMLReport(coverage: CoverageReport): string {
    const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ユーザーストーリー カバレッジレポート</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      margin-bottom: 30px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .metric {
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .metric h3 {
      margin: 0 0 10px 0;
      color: #666;
      font-size: 14px;
      font-weight: normal;
    }
    .metric .value {
      font-size: 32px;
      font-weight: bold;
      color: #333;
    }
    .metric.coverage {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .metric.coverage h3 {
      color: rgba(255,255,255,0.8);
    }
    .metric.coverage .value {
      color: white;
    }
    .stories {
      margin-top: 40px;
    }
    .story {
      margin-bottom: 30px;
      border: 1px solid #e1e4e8;
      border-radius: 8px;
      overflow: hidden;
    }
    .story-header {
      padding: 15px 20px;
      background: #f6f8fa;
      border-bottom: 1px solid #e1e4e8;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .story-title {
      font-weight: bold;
      color: #333;
    }
    .story-status {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .status-completed {
      background: #d4edda;
      color: #155724;
    }
    .status-partial {
      background: #fff3cd;
      color: #856404;
    }
    .status-pending {
      background: #f8d7da;
      color: #721c24;
    }
    .scenarios {
      padding: 20px;
    }
    .scenario {
      margin-bottom: 15px;
      padding: 10px;
      border-left: 3px solid #e1e4e8;
      padding-left: 15px;
    }
    .scenario.passed {
      border-color: #28a745;
    }
    .scenario.failed {
      border-color: #dc3545;
    }
    .scenario.not-implemented {
      border-color: #6c757d;
    }
    .scenario-title {
      font-weight: 500;
      margin-bottom: 5px;
    }
    .test-info {
      font-size: 12px;
      color: #666;
    }
    .test-file {
      font-family: monospace;
      background: #f6f8fa;
      padding: 2px 6px;
      border-radius: 3px;
    }
    .last-updated {
      text-align: center;
      color: #666;
      font-size: 14px;
      margin-top: 40px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>ユーザーストーリー カバレッジレポート</h1>
    
    <div class="summary">
      <div class="metric coverage">
        <h3>カバレッジ</h3>
        <div class="value">${coverage.coveragePercentage.toFixed(1)}%</div>
      </div>
      <div class="metric">
        <h3>ストーリー</h3>
        <div class="value">${coverage.implementedStories}/${coverage.totalStories}</div>
      </div>
      <div class="metric">
        <h3>シナリオ</h3>
        <div class="value">${coverage.implementedScenarios}/${coverage.totalScenarios}</div>
      </div>
    </div>

    <div class="stories">
      ${userStories.map((story) => this.renderStory(story, coverage)).join('')}
    </div>

    <div class="last-updated">
      最終更新: ${new Date(coverage.lastUpdated).toLocaleString('ja-JP')}
    </div>
  </div>
</body>
</html>
    `;

    return html;
  }

  private static renderStory(story: UserStory, coverage: CoverageReport): string {
    const storyResults = coverage.testResults.filter((r) => r.storyId === story.id);
    const implementedCount = storyResults.filter((r) => r.status !== 'not-implemented').length;
    const totalCount = story.scenarios.length;

    let statusClass = 'pending';
    let statusText = '未実装';

    if (implementedCount === totalCount) {
      statusClass = 'completed';
      statusText = '完了';
    } else if (implementedCount > 0) {
      statusClass = 'partial';
      statusText = `${implementedCount}/${totalCount} 実装済み`;
    }

    return `
      <div class="story">
        <div class="story-header">
          <div class="story-title">${story.id}: ${story.title}</div>
          <div class="story-status status-${statusClass}">${statusText}</div>
        </div>
        <div class="scenarios">
          ${story.scenarios.map((scenario) => this.renderScenario(scenario, storyResults)).join('')}
        </div>
      </div>
    `;
  }

  private static renderScenario(scenario: Scenario, results: TestResult[]): string {
    const result = results.find((r) => r.scenarioId === scenario.id);
    const statusClass = result ? result.status.replace('-', '') : 'not-implemented';

    return `
      <div class="scenario ${statusClass}">
        <div class="scenario-title">${scenario.id}: ${scenario.description}</div>
        ${
          scenario.testFiles
            ? `
          <div class="test-info">
            テストファイル: <span class="test-file">${scenario.testFiles[0] || 'なし'}</span>
            ${result && result.duration ? ` | 実行時間: ${result.duration}ms` : ''}
            ${result && result.status === 'failed' ? ` | エラー: ${result.failureReason}` : ''}
          </div>
        `
            : ''
        }
      </div>
    `;
  }

  /**
   * Markdown形式のレポートを生成
   */
  static generateMarkdownReport(coverage: CoverageReport): string {
    let markdown = `# ユーザーストーリー カバレッジレポート

最終更新: ${new Date(coverage.lastUpdated).toLocaleString('ja-JP')}

## サマリー

- **カバレッジ**: ${coverage.coveragePercentage.toFixed(1)}%
- **実装済みストーリー**: ${coverage.implementedStories}/${coverage.totalStories}
- **実装済みシナリオ**: ${coverage.implementedScenarios}/${coverage.totalScenarios}

## ストーリー別詳細

`;

    for (const story of userStories) {
      const storyResults = coverage.testResults.filter((r) => r.storyId === story.id);
      const implementedCount = storyResults.filter((r) => r.status !== 'not-implemented').length;

      markdown += `### ${story.id}: ${story.title}\n\n`;
      markdown += `- **ペルソナ**: ${story.persona.name} (${story.persona.role})\n`;
      markdown += `- **実装状況**: ${implementedCount}/${story.scenarios.length} シナリオ\n`;
      markdown += `- **優先度**: ${story.priority}\n\n`;

      markdown += `#### シナリオ一覧\n\n`;

      for (const scenario of story.scenarios) {
        const result = storyResults.find((r) => r.scenarioId === scenario.id);
        const status = result ? result.status : 'not-implemented';
        const statusEmoji = {
          passed: '✅',
          failed: '❌',
          skipped: '⏭️',
          'not-implemented': '📝',
        }[status];

        markdown += `- ${statusEmoji} **${scenario.id}**: ${scenario.description}\n`;

        if (scenario.testFiles && scenario.testFiles.length > 0) {
          markdown += `  - テストファイル: \`${scenario.testFiles[0]}\`\n`;
        }

        if (result && result.status === 'failed' && result.failureReason) {
          markdown += `  - ❌ エラー: ${result.failureReason}\n`;
        }

        markdown += '\n';
      }

      markdown += `#### 受け入れ条件\n\n`;
      for (const criteria of story.acceptanceCriteria) {
        markdown += `- [ ] ${criteria}\n`;
      }

      markdown += '\n---\n\n';
    }

    return markdown;
  }
}

// CLIとして実行された場合
if (require.main === module) {
  // レポート生成
  StoryCoverageReporter.generateReport('./playwright-report')
    .then((coverage) => {
      // HTML レポート
      const htmlReport = StoryCoverageReporter.generateHTMLReport(coverage);
      writeFileSync('./story-coverage.html', htmlReport);
      console.log('HTML report generated: story-coverage.html');

      // Markdown レポート
      const markdownReport = StoryCoverageReporter.generateMarkdownReport(coverage);
      writeFileSync('./story-coverage.md', markdownReport);
      console.log('Markdown report generated: story-coverage.md');

      // コンソール出力
      console.log(`\nカバレッジ: ${coverage.coveragePercentage.toFixed(1)}%`);
      console.log(`実装済み: ${coverage.implementedScenarios}/${coverage.totalScenarios} シナリオ`);
    })
    .catch((error) => {
      console.error('Failed to generate report:', error);
      process.exit(1);
    });
}
