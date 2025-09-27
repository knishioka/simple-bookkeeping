import fs from 'fs';

import type { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';

interface PerformanceData {
  testName: string;
  duration: number;
  status: string;
  retries: number;
  timestamp: string;
}

/**
 * Custom Playwright reporter for performance monitoring
 * Issue #326: Full E2E test suite re-enablement with performance tracking
 */
export default class PerformanceReporter implements Reporter {
  private performanceData: PerformanceData[] = [];
  private startTime: number = 0;
  private totalTests = 0;
  private passedTests = 0;
  private failedTests = 0;

  onBegin() {
    this.startTime = Date.now();
    console.log('📊 Performance monitoring started');
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this.totalTests++;

    if (result.status === 'passed') {
      this.passedTests++;
    } else if (result.status === 'failed') {
      this.failedTests++;
    }

    const performanceEntry: PerformanceData = {
      testName: test.title,
      duration: result.duration,
      status: result.status,
      retries: result.retry,
      timestamp: new Date().toISOString(),
    };

    this.performanceData.push(performanceEntry);

    // Log slow tests (> 30 seconds)
    if (result.duration > 30000) {
      console.log(`⚠️  Slow test detected: ${test.title} (${Math.round(result.duration / 1000)}s)`);
    }
  }

  onEnd(_result: FullResult) {
    const totalDuration = Date.now() - this.startTime;
    const avgTestDuration =
      this.performanceData.length > 0
        ? this.performanceData.reduce((sum, test) => sum + test.duration, 0) /
          this.performanceData.length
        : 0;

    const slowestTest = this.performanceData.reduce(
      (slowest, current) => (current.duration > slowest.duration ? current : slowest),
      { testName: '', duration: 0, status: '', retries: 0, timestamp: '' }
    );

    // Performance summary
    console.log('\n📈 Performance Summary:');
    console.log(`  Total Duration: ${Math.round(totalDuration / 1000)}s`);
    console.log(`  Tests: ${this.totalTests} (✅ ${this.passedTests}, ❌ ${this.failedTests})`);
    console.log(`  Average Test Duration: ${Math.round(avgTestDuration / 1000)}s`);
    console.log(
      `  Slowest Test: ${slowestTest.testName} (${Math.round(slowestTest.duration / 1000)}s)`
    );

    // Save performance data to file
    const performanceReport = {
      summary: {
        totalDuration,
        totalTests: this.totalTests,
        passedTests: this.passedTests,
        failedTests: this.failedTests,
        avgTestDuration,
        slowestTest,
        timestamp: new Date().toISOString(),
      },
      tests: this.performanceData,
    };

    try {
      fs.writeFileSync(
        'test-results/performance-report.json',
        JSON.stringify(performanceReport, null, 2)
      );
      console.log('📁 Performance report saved to test-results/performance-report.json');
    } catch (error) {
      console.error('❌ Failed to save performance report:', error);
    }

    // GitHub Actions step summary
    if (process.env.CI) {
      try {
        const summaryFile = process.env.GITHUB_STEP_SUMMARY;
        if (summaryFile) {
          const summary = `## 🎭 E2E Test Performance Report

### Summary
- **Total Duration**: ${Math.round(totalDuration / 1000)}s
- **Tests**: ${this.totalTests} total (✅ ${this.passedTests} passed, ❌ ${this.failedTests} failed)
- **Average Test Duration**: ${Math.round(avgTestDuration / 1000)}s
- **Slowest Test**: ${slowestTest.testName} (${Math.round(slowestTest.duration / 1000)}s)

### Performance Insights
${this.generatePerformanceInsights()}
`;

          // eslint-disable-next-line security/detect-non-literal-fs-filename -- GitHub Actions path is controlled
          fs.appendFileSync(summaryFile, summary);
        }
      } catch (error) {
        console.error('❌ Failed to write GitHub step summary:', error);
      }
    }
  }

  private generatePerformanceInsights(): string {
    const slowTests = this.performanceData.filter((test) => test.duration > 30000);
    const retriedTests = this.performanceData.filter((test) => test.retries > 0);

    let insights = '';

    if (slowTests.length > 0) {
      insights += `- 🐌 **${slowTests.length} slow tests** (>30s): Consider optimization\n`;
    }

    if (retriedTests.length > 0) {
      insights += `- 🔄 **${retriedTests.length} tests** required retries: May indicate flaky tests\n`;
    }

    if (this.failedTests === 0 && slowTests.length === 0) {
      insights += '- 🎉 **All tests passed** with good performance!\n';
    }

    return insights || '- No specific performance issues detected\n';
  }
}
