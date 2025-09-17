/**
 * Test-Related Error Patterns
 */

import { ErrorPattern, ErrorCategory, ErrorSeverity } from '../types';

export const testPatterns: ErrorPattern[] = [
  {
    id: 'jest-test-failure',
    category: ErrorCategory.TEST_FAILURE,
    severity: ErrorSeverity.HIGH,
    patterns: [
      /FAIL\s+(.+\.(?:test|spec)\.[jt]sx?)/,
      /✕\s+(.+)\s+\(\d+\s*ms\)/,
      /expect\((.+?)\)\.(.+?)(?:\((.+?)\))?\s+(.+)/,
      /Expected:\s+(.+)\s+Received:\s+(.+)/,
      /Tests:\s+\d+\s+failed/,
    ],
    description: 'Jest test failure',
    commonCauses: [
      'Assertion failures',
      'Unexpected values in tests',
      'Changed implementation breaking tests',
      'Incorrect test setup',
      'Missing mock data',
    ],
    suggestedFixes: [
      'Review the failing assertion',
      'Update test expectations if implementation changed',
      'Check test data and mocks',
      'Run tests locally to debug',
      'Review recent code changes',
    ],
    confidence: 0.95,
  },

  {
    id: 'playwright-test-failure',
    category: ErrorCategory.TEST_FAILURE,
    severity: ErrorSeverity.HIGH,
    patterns: [
      /\[chromium\]\s+›\s+(.+):\d+:\d+\s+›\s+(.+)/,
      /Error:\s+Test timeout of\s+\d+ms exceeded/,
      /Timeout\s+\d+ms exceeded/,
      /locator\.(.+?)\(\)/,
      /page\.goto\(.+?\)\s+failed/,
    ],
    description: 'Playwright E2E test failure',
    commonCauses: [
      'Element not found on page',
      'Page load timeout',
      'Incorrect selectors',
      'Race conditions in UI',
      'Network issues during test',
    ],
    suggestedFixes: [
      'Check element selectors',
      'Increase timeout for slow operations',
      'Add proper wait conditions',
      'Review page navigation flow',
      'Check if application is running',
    ],
    confidence: 0.9,
  },

  {
    id: 'test-setup-error',
    category: ErrorCategory.TEST_SETUP,
    severity: ErrorSeverity.CRITICAL,
    patterns: [
      /beforeAll\(\) failed/,
      /beforeEach\(\) failed/,
      /Test suite failed to run/,
      /Cannot find test module/,
      /Test environment setup failed/,
    ],
    description: 'Test setup or configuration error',
    commonCauses: [
      'Missing test configuration',
      'Database connection issues',
      'Missing environment variables',
      'Incorrect test setup',
      'Module resolution problems',
    ],
    suggestedFixes: [
      'Check test configuration files',
      'Verify environment variables are set',
      'Ensure database is accessible',
      'Review test setup hooks',
      'Check module paths in tests',
    ],
    confidence: 0.95,
  },

  {
    id: 'snapshot-mismatch',
    category: ErrorCategory.TEST_FAILURE,
    severity: ErrorSeverity.MEDIUM,
    patterns: [
      /Snapshot\s+name:\s+`(.+)`/,
      /toMatchSnapshot/,
      /Snapshot Summary/,
      /\d+\s+snapshot(?:s)?\s+failed/,
      /snapshots? obsolete/,
    ],
    description: 'Jest snapshot mismatch',
    commonCauses: [
      'Component output changed',
      'Intentional UI changes',
      'Formatting changes',
      'Data changes affecting rendering',
      'Outdated snapshots',
    ],
    suggestedFixes: [
      'Review snapshot differences',
      'Update snapshots if changes are intentional (jest -u)',
      'Check for unintended changes',
      'Remove obsolete snapshots',
      'Verify component rendering logic',
    ],
    confidence: 0.85,
  },

  {
    id: 'mock-error',
    category: ErrorCategory.TEST_FAILURE,
    severity: ErrorSeverity.HIGH,
    patterns: [
      /Cannot spy the\s+(.+)\s+property/,
      /jest\.mock.*failed/,
      /Mock function not called/,
      /Expected mock function.*to have been called/,
      /mockImplementation/,
    ],
    description: 'Mock or spy configuration error',
    commonCauses: [
      'Incorrect mock setup',
      'Trying to mock non-existent methods',
      'Mock not being called as expected',
      'Incorrect spy configuration',
      'Module mocking issues',
    ],
    suggestedFixes: [
      'Verify mock setup is correct',
      'Check if mocked methods exist',
      'Ensure mocked functions are called',
      'Review spy configuration',
      'Clear mocks between tests',
    ],
    confidence: 0.85,
  },

  {
    id: 'coverage-threshold',
    category: ErrorCategory.TEST_FAILURE,
    severity: ErrorSeverity.MEDIUM,
    patterns: [
      /Coverage threshold for\s+(.+)\s+not met/,
      /Jest:\s+"?Coverage(?:Threshold)?.*not met/,
      /Coverage.*below threshold/,
      /Global coverage threshold not met/,
    ],
    description: 'Code coverage below threshold',
    commonCauses: [
      'Insufficient test coverage',
      'New code without tests',
      'Removed tests',
      'Changed coverage thresholds',
      'Uncovered branches or statements',
    ],
    suggestedFixes: [
      'Add tests for uncovered code',
      'Review coverage report',
      'Check recently added code',
      'Adjust coverage thresholds if appropriate',
      'Focus on critical path coverage',
    ],
    confidence: 0.9,
  },

  {
    id: 'async-test-error',
    category: ErrorCategory.TEST_FAILURE,
    severity: ErrorSeverity.HIGH,
    patterns: [
      /done\(\) callback not called/,
      /Async callback.*not invoked/,
      /Promise returned.*test.*but.*not.*await/,
      /Cannot log after tests are done/,
      /Attempted to log.*after test completion/,
    ],
    description: 'Asynchronous test error',
    commonCauses: [
      'Missing done() callback',
      'Unhandled promises in tests',
      'Missing await for async operations',
      'Test completing before async operations',
      'Improper async test setup',
    ],
    suggestedFixes: [
      'Add done() callback for async tests',
      'Use async/await properly in tests',
      'Return promises from test functions',
      'Ensure all async operations complete',
      'Check for proper test cleanup',
    ],
    confidence: 0.9,
  },
];
