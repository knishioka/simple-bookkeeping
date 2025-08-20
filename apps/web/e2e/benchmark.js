#!/usr/bin/env node

/**
 * E2Eテストパフォーマンスベンチマーク
 * Issue #202: E2Eテストのパフォーマンス最適化
 *
 * 使用方法:
 * node apps/web/e2e/benchmark.js
 */

/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-console */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI カラーコード
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function runBenchmark() {
  log('\n=== E2Eテストパフォーマンスベンチマーク ===\n', colors.bold + colors.cyan);

  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: {
      totalTime: 0,
      totalTests: 0,
      averageTime: 0,
      improvements: [],
    },
  };

  // ベンチマーク設定
  const configs = [
    {
      name: 'デフォルト設定（並列度4）',
      workers: 4,
      env: {},
    },
    {
      name: '最適化設定（並列度6）',
      workers: 6,
      env: {},
    },
    {
      name: '最大並列化（並列度8）',
      workers: 8,
      env: {},
    },
  ];

  log('テスト実行中...\n', colors.yellow);

  configs.forEach((config) => {
    log(`\n📊 ${config.name}`, colors.bold);
    log(`   ワーカー数: ${config.workers}`, colors.cyan);

    const startTime = Date.now();

    try {
      // テスト実行
      const command = `REUSE_SERVER=true npx playwright test --workers=${config.workers} --reporter=json`;
      const output = execSync(command, {
        cwd: path.resolve(__dirname, '../../'),
        env: { ...process.env, ...config.env },
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'], // stderrを無視
      });

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // 秒に変換

      // JSON出力をパース
      let testResults;
      try {
        testResults = JSON.parse(output);
      } catch {
        // JSONパースに失敗した場合は基本情報のみ
        testResults = { tests: [] };
      }

      const testCount = testResults.tests ? testResults.tests.length : 0;

      results.tests.push({
        config: config.name,
        workers: config.workers,
        duration,
        testCount,
        testsPerSecond: testCount > 0 ? (testCount / duration).toFixed(2) : 0,
      });

      log(`   ✅ 完了: ${duration.toFixed(2)}秒`, colors.green);
      log(`   実行テスト数: ${testCount}`, colors.cyan);
      log(`   テスト/秒: ${(testCount / duration).toFixed(2)}`, colors.cyan);
    } catch (error) {
      log(`   ❌ エラー: ${error.message}`, colors.red);
      results.tests.push({
        config: config.name,
        workers: config.workers,
        duration: null,
        error: error.message,
      });
    }
  });

  // サマリー計算
  const validTests = results.tests.filter((t) => t.duration !== null);
  if (validTests.length > 0) {
    results.summary.totalTests = validTests.length;
    results.summary.totalTime = validTests.reduce((sum, t) => sum + t.duration, 0);
    results.summary.averageTime = results.summary.totalTime / validTests.length;

    // 改善率の計算（最初の設定を基準）
    const baseline = validTests[0];
    validTests.forEach((test, index) => {
      if (index > 0 && baseline.duration && test.duration) {
        const improvement = (
          ((baseline.duration - test.duration) / baseline.duration) *
          100
        ).toFixed(1);
        results.summary.improvements.push({
          config: test.config,
          improvement: `${improvement}%`,
          timeSaved: `${(baseline.duration - test.duration).toFixed(2)}秒`,
        });
      }
    });
  }

  // 結果の表示
  log('\n\n=== ベンチマーク結果 ===\n', colors.bold + colors.cyan);

  results.tests.forEach((test) => {
    if (test.duration !== null) {
      log(`${test.config}:`, colors.bold);
      log(`  実行時間: ${test.duration.toFixed(2)}秒`, colors.green);
      log(`  テスト数: ${test.testCount}`, colors.cyan);
      log(`  スループット: ${test.testsPerSecond} tests/sec`, colors.cyan);
    }
  });

  if (results.summary.improvements.length > 0) {
    log('\n=== パフォーマンス改善 ===\n', colors.bold + colors.yellow);
    results.summary.improvements.forEach((imp) => {
      log(`${imp.config}:`, colors.bold);
      log(`  改善率: ${imp.improvement}`, colors.green);
      log(`  短縮時間: ${imp.timeSaved}`, colors.green);
    });
  }

  // 推奨設定
  if (validTests.length > 0) {
    const fastest = validTests.reduce((prev, current) =>
      prev.duration < current.duration ? prev : current
    );

    log('\n=== 推奨設定 ===\n', colors.bold + colors.green);
    log(`最速設定: ${fastest.config}`, colors.bold);
    log(`実行時間: ${fastest.duration.toFixed(2)}秒`, colors.green);
    log(`ワーカー数: ${fastest.workers}`, colors.cyan);
  }

  // 結果をファイルに保存
  const resultFile = path.join(__dirname, 'benchmark-results.json');
  fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
  log(`\n結果を保存しました: ${resultFile}`, colors.cyan);
}

// メイン実行
if (require.main === module) {
  try {
    runBenchmark();
  } catch (error) {
    log(`\nエラーが発生しました: ${error.message}`, colors.red);
    process.exit(1);
  }
}
