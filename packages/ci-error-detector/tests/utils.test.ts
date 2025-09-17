/**
 * Tests for utility functions
 */

import { ErrorCategory, ErrorSeverity, ClassifiedError } from '../src/types';
import {
  extractContext,
  calculateConfidence,
  deduplicateErrors,
  groupErrorsByCategory,
  sortErrorsByPriority,
  detectFlakyTests,
  analyzeErrorTrends,
  formatError,
  parseTimestamp,
  extractErrorLocation,
  sanitizeErrorMessage,
} from '../src/utils';

describe('Utility Functions', () => {
  describe('extractContext', () => {
    it('should extract file path and line numbers', () => {
      const logs = 'Error at /app/src/index.ts:42:10';
      const context = extractContext(logs);

      expect(context.file).toBe('/app/src/index.ts');
      expect(context.line).toBe(42);
      expect(context.column).toBe(10);
    });

    it('should extract function names', () => {
      const logs = 'at handleRequest (/app/server.js:10:5)';
      const context = extractContext(logs);

      expect(context.function).toBe('handleRequest');
    });

    it('should extract stack trace', () => {
      const logs = `
        Error: Test
          at functionA (a.js:1:1)
          at functionB (b.js:2:2)
          at functionC (c.js:3:3)
      `;
      const context = extractContext(logs);

      expect(context.stackTrace).toBeDefined();
      expect(context.stackTrace?.length).toBeGreaterThan(0);
      expect(context.stackTrace?.[0]).toContain('at functionA');
    });

    it('should extract GitHub Actions workflow step', () => {
      const logs = '##[group]Run npm test';
      const context = extractContext(logs);

      expect(context.workflowStep).toBe('npm test');
    });

    it('should extract timestamps', () => {
      const logs = '2024-01-15T10:30:45Z Error occurred';
      const context = extractContext(logs);

      expect(context.timestamp).toBe('2024-01-15T10:30:45');
    });
  });

  describe('calculateConfidence', () => {
    it('should calculate confidence based on match count', () => {
      const confidence = calculateConfidence(3, 0.8, 0.6);
      expect(confidence).toBeGreaterThan(0.5);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('should cap confidence at 1.0', () => {
      const confidence = calculateConfidence(10, 1.0, 1.0);
      expect(confidence).toBe(1);
    });

    it('should handle zero values', () => {
      const confidence = calculateConfidence(0, 0, 0);
      expect(confidence).toBe(0);
    });
  });

  describe('deduplicateErrors', () => {
    it('should remove duplicate errors', () => {
      const errors: ClassifiedError[] = [
        {
          id: '1',
          category: ErrorCategory.RUNTIME,
          severity: ErrorSeverity.HIGH,
          confidence: 0.8,
          message: 'Cannot read property x of null',
          rawError: 'TypeError: Cannot read property x of null',
          context: {},
          patterns: ['null-ref'],
          suggestedFixes: ['Add null check'],
        },
        {
          id: '2',
          category: ErrorCategory.RUNTIME,
          severity: ErrorSeverity.HIGH,
          confidence: 0.7,
          message: 'Cannot read property x of null',
          rawError: 'TypeError: Cannot read property x of null',
          context: {},
          patterns: ['null-ref'],
          suggestedFixes: ['Use optional chaining'],
        },
      ];

      const deduplicated = deduplicateErrors(errors);
      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0].confidence).toBe(0.8); // Should keep higher confidence
    });

    it('should merge suggested fixes for duplicates', () => {
      const errors: ClassifiedError[] = [
        {
          id: '1',
          category: ErrorCategory.RUNTIME,
          severity: ErrorSeverity.HIGH,
          confidence: 0.8,
          message: 'Error message',
          rawError: 'Error',
          context: {},
          patterns: ['pattern1'],
          suggestedFixes: ['Fix 1'],
        },
        {
          id: '2',
          category: ErrorCategory.RUNTIME,
          severity: ErrorSeverity.HIGH,
          confidence: 0.8,
          message: 'Error message',
          rawError: 'Error',
          context: {},
          patterns: ['pattern1'],
          suggestedFixes: ['Fix 2'],
        },
      ];

      const deduplicated = deduplicateErrors(errors);
      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0].suggestedFixes).toContain('Fix 1');
      expect(deduplicated[0].suggestedFixes).toContain('Fix 2');
    });
  });

  describe('groupErrorsByCategory', () => {
    it('should group errors by their category', () => {
      const errors: ClassifiedError[] = [
        {
          id: '1',
          category: ErrorCategory.RUNTIME,
          severity: ErrorSeverity.HIGH,
          confidence: 0.8,
          message: 'Runtime error',
          rawError: 'Error',
          context: {},
          patterns: [],
          suggestedFixes: [],
        },
        {
          id: '2',
          category: ErrorCategory.TEST_FAILURE,
          severity: ErrorSeverity.HIGH,
          confidence: 0.9,
          message: 'Test failed',
          rawError: 'Test error',
          context: {},
          patterns: [],
          suggestedFixes: [],
        },
        {
          id: '3',
          category: ErrorCategory.RUNTIME,
          severity: ErrorSeverity.MEDIUM,
          confidence: 0.7,
          message: 'Another runtime error',
          rawError: 'Error 2',
          context: {},
          patterns: [],
          suggestedFixes: [],
        },
      ];

      const grouped = groupErrorsByCategory(errors);

      expect(grouped.get(ErrorCategory.RUNTIME)?.length).toBe(2);
      expect(grouped.get(ErrorCategory.TEST_FAILURE)?.length).toBe(1);
    });
  });

  describe('sortErrorsByPriority', () => {
    it('should sort by severity then confidence', () => {
      const errors: ClassifiedError[] = [
        {
          id: '1',
          category: ErrorCategory.RUNTIME,
          severity: ErrorSeverity.MEDIUM,
          confidence: 0.9,
          message: 'Medium severity, high confidence',
          rawError: '',
          context: {},
          patterns: [],
          suggestedFixes: [],
        },
        {
          id: '2',
          category: ErrorCategory.RUNTIME,
          severity: ErrorSeverity.CRITICAL,
          confidence: 0.7,
          message: 'Critical severity, low confidence',
          rawError: '',
          context: {},
          patterns: [],
          suggestedFixes: [],
        },
        {
          id: '3',
          category: ErrorCategory.RUNTIME,
          severity: ErrorSeverity.CRITICAL,
          confidence: 0.9,
          message: 'Critical severity, high confidence',
          rawError: '',
          context: {},
          patterns: [],
          suggestedFixes: [],
        },
      ];

      const sorted = sortErrorsByPriority(errors);

      expect(sorted[0].id).toBe('3'); // Critical, high confidence
      expect(sorted[1].id).toBe('2'); // Critical, low confidence
      expect(sorted[2].id).toBe('1'); // Medium, high confidence
    });
  });

  describe('detectFlakyTests', () => {
    it('should identify flaky tests', () => {
      const testHistory = [
        { testName: 'test1', failed: true, timestamp: '2024-01-01' },
        { testName: 'test1', failed: false, timestamp: '2024-01-02' },
        { testName: 'test1', failed: true, timestamp: '2024-01-03' },
        { testName: 'test1', failed: false, timestamp: '2024-01-04' },
        { testName: 'test2', failed: false, timestamp: '2024-01-01' },
        { testName: 'test2', failed: false, timestamp: '2024-01-02' },
      ];

      const flakyTests = detectFlakyTests(testHistory);

      expect(flakyTests).toHaveLength(1);
      expect(flakyTests[0].testName).toBe('test1');
      expect(flakyTests[0].failureRate).toBe(0.5);
      expect(flakyTests[0].isFlaky).toBe(true);
    });

    it('should not mark consistently passing tests as flaky', () => {
      const testHistory = [
        { testName: 'stable-test', failed: false, timestamp: '2024-01-01' },
        { testName: 'stable-test', failed: false, timestamp: '2024-01-02' },
        { testName: 'stable-test', failed: false, timestamp: '2024-01-03' },
      ];

      const flakyTests = detectFlakyTests(testHistory);

      expect(flakyTests).toHaveLength(0);
    });
  });

  describe('analyzeErrorTrends', () => {
    it('should identify increasing error trends', () => {
      const errors = [
        { category: ErrorCategory.RUNTIME, timestamp: '2024-01-01T00:00:00Z' },
        { category: ErrorCategory.RUNTIME, timestamp: '2024-01-02T00:00:00Z' },
        { category: ErrorCategory.RUNTIME, timestamp: '2024-01-02T12:00:00Z' },
        { category: ErrorCategory.RUNTIME, timestamp: '2024-01-03T00:00:00Z' },
        { category: ErrorCategory.RUNTIME, timestamp: '2024-01-03T06:00:00Z' },
        { category: ErrorCategory.RUNTIME, timestamp: '2024-01-03T12:00:00Z' },
      ];

      const trends = analyzeErrorTrends(errors);

      expect(trends).toHaveLength(1);
      expect(trends[0].category).toBe(ErrorCategory.RUNTIME);
      expect(trends[0].trend).toBe('increasing');
    });

    it('should calculate change rate', () => {
      const errors = [
        { category: ErrorCategory.TEST_FAILURE, timestamp: '2024-01-01T00:00:00Z' },
        { category: ErrorCategory.TEST_FAILURE, timestamp: '2024-01-02T00:00:00Z' },
        { category: ErrorCategory.TEST_FAILURE, timestamp: '2024-01-02T12:00:00Z' },
      ];

      const trends = analyzeErrorTrends(errors);

      expect(trends[0].changeRate).toBeDefined();
      expect(trends[0].changeRate).toBeGreaterThan(0);
    });
  });

  describe('sanitizeErrorMessage', () => {
    it('should redact sensitive information', () => {
      const message = 'API call failed with Bearer abc123def456';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).toBe('API call failed with Bearer [REDACTED]');
    });

    it('should redact API keys', () => {
      const message = 'Connection failed: api_key=secret123xyz';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).toBe('Connection failed: api_key=[REDACTED]');
    });

    it('should redact email addresses', () => {
      const message = 'User john.doe@example.com not found';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).toBe('User [EMAIL] not found');
    });

    it('should redact IP addresses', () => {
      const message = 'Cannot connect to 192.168.1.100';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).toBe('Cannot connect to [IP]');
    });

    it('should redact user paths', () => {
      const message = 'File not found: /Users/johndoe/project/file.txt';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).toBe('File not found: /Users/[USER]');
    });
  });

  describe('parseTimestamp', () => {
    it('should parse ISO 8601 timestamps', () => {
      const line = '2024-01-15T10:30:45.123Z Error occurred';
      const timestamp = parseTimestamp(line);

      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp?.toISOString()).toContain('2024-01-15');
    });

    it('should parse standard format timestamps', () => {
      const line = '2024-01-15 10:30:45 Starting process';
      const timestamp = parseTimestamp(line);

      expect(timestamp).toBeInstanceOf(Date);
    });

    it('should return null for lines without timestamps', () => {
      const line = 'Just a regular error message';
      const timestamp = parseTimestamp(line);

      expect(timestamp).toBeNull();
    });
  });

  describe('extractErrorLocation', () => {
    it('should extract location from stack trace', () => {
      const stackTrace = [
        'at handleRequest (/app/src/server.js:45:12)',
        'at process (/app/src/index.js:10:5)',
      ];

      const location = extractErrorLocation(stackTrace);

      expect(location).toEqual({
        function: 'handleRequest',
        file: '/app/src/server.js',
        line: 45,
        column: 12,
      });
    });

    it('should handle anonymous functions', () => {
      const stackTrace = ['at /app/src/utils.js:20:8', 'at Array.map (<anonymous>)'];

      const location = extractErrorLocation(stackTrace);

      expect(location).toEqual({
        function: undefined,
        file: '/app/src/utils.js',
        line: 20,
        column: 8,
      });
    });

    it('should return null for empty stack trace', () => {
      const location = extractErrorLocation([]);
      expect(location).toBeNull();
    });
  });

  describe('formatError', () => {
    it('should format error for display', () => {
      const error: ClassifiedError = {
        id: '1',
        category: ErrorCategory.RUNTIME,
        severity: ErrorSeverity.HIGH,
        confidence: 0.85,
        message: 'Null reference error',
        rawError: 'TypeError: Cannot read property',
        context: {
          file: '/app/index.js',
          line: 42,
          column: 10,
        },
        patterns: ['null-ref'],
        suggestedFixes: ['Add null check', 'Use optional chaining'],
      };

      const formatted = formatError(error);

      expect(formatted).toContain('[HIGH] runtime');
      expect(formatted).toContain('Message: Null reference error');
      expect(formatted).toContain('Confidence: 85.0%');
      expect(formatted).toContain('File: /app/index.js:42:10');
      expect(formatted).toContain('Add null check');
      expect(formatted).toContain('Use optional chaining');
    });
  });
});
