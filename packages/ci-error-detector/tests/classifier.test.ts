/**
 * Tests for CI Error Classifier
 */

import { CIErrorClassifier } from '../src/core/classifier';
import { ErrorCategory, ErrorSeverity, ClassificationOptions } from '../src/types';

describe('CIErrorClassifier', () => {
  let classifier: CIErrorClassifier;

  beforeEach(() => {
    classifier = new CIErrorClassifier();
  });

  describe('TypeScript Errors', () => {
    it('should classify TypeScript syntax errors', () => {
      const logs = `
        src/components/Button.tsx:15:5 - error TS2322: Type 'string' is not assignable to type 'number'.

        15     count = "hello";
               ~~~~~

        Found 1 error.
      `;

      const result = classifier.classify(logs);

      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      // Find the type error (may have multiple matches)
      const typeError = result.errors.find((e) => e.category === ErrorCategory.TYPE);
      expect(typeError).toBeDefined();
      expect(typeError?.severity).toBe(ErrorSeverity.HIGH);
      expect(typeError?.confidence).toBeGreaterThan(0.7);
    });

    it('should classify module not found errors', () => {
      const logs = `
        Error: Cannot find module 'express'
        Require stack:
        - /app/src/server.js
        - /app/src/index.js
      `;

      const result = classifier.classify(logs);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].category).toBe(ErrorCategory.MODULE_NOT_FOUND);
      expect(result.errors[0].severity).toBe(ErrorSeverity.CRITICAL);
      expect(result.errors[0].suggestedFixes).toContain(
        'Run npm/pnpm install to install dependencies'
      );
    });
  });

  describe('Runtime Errors', () => {
    it('should classify null reference errors', () => {
      const logs = `
        TypeError: Cannot read property 'name' of undefined
          at UserProfile (/app/src/components/UserProfile.jsx:23:15)
          at processChild (/app/node_modules/react-dom/cjs/react-dom.development.js:3356:14)
      `;

      const result = classifier.classify(logs);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].category).toBe(ErrorCategory.RUNTIME);
      expect(result.errors[0].severity).toBe(ErrorSeverity.HIGH);
      expect(result.errors[0].context.function).toBe('UserProfile');
    });

    it('should classify memory errors', () => {
      const logs = `
        FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
        1: 0x10123456 node::Abort() [/usr/local/bin/node]
        2: 0x10123457 node::OnFatalError() [/usr/local/bin/node]
      `;

      const result = classifier.classify(logs);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].category).toBe(ErrorCategory.MEMORY);
      expect(result.errors[0].severity).toBe(ErrorSeverity.CRITICAL);
      expect(result.errors[0].confidence).toBe(1.0);
    });
  });

  describe('Test Failures', () => {
    it('should classify Jest test failures', () => {
      const logs = `
        FAIL src/components/Button.test.tsx
          Button Component
            ✕ should render correctly (45 ms)
            ✓ should handle click events (12 ms)

        ● Button Component › should render correctly

          expect(received).toContain(expected)

          Expected substring: "Click me"
          Received string:    "Submit"

            25 |   const { getByText } = render(<Button />);
            26 |   const button = getByText('Submit');
          > 27 |   expect(button.textContent).toContain('Click me');
               |                              ^
      `;

      const result = classifier.classify(logs);

      expect(result.errors.length).toBeGreaterThan(0);
      const testError = result.errors.find((e) => e.category === ErrorCategory.TEST_FAILURE);
      expect(testError).toBeDefined();
      expect(testError?.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should classify Playwright E2E test failures', () => {
      const logs = `
        [chromium] › auth/login.spec.ts:15:5 › Login flow › should login successfully

        Error: Test timeout of 30000ms exceeded.
        Error: locator.click: Target closed
        =========================== logs ===========================
        waiting for locator('#submit-button')
        ============================================================
      `;

      const result = classifier.classify(logs);

      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      // Find the test failure error
      const testError = result.errors.find((e) => e.category === ErrorCategory.TEST_FAILURE);
      expect(testError).toBeDefined();
      // Check that at least one error mentions timeout
      const hasTimeoutError = result.errors.some(
        (e) =>
          e.message.toLowerCase().includes('timeout') ||
          e.rawError.toLowerCase().includes('timeout')
      );
      expect(hasTimeoutError).toBe(true);
    });
  });

  describe('Environment Errors', () => {
    it('should classify missing environment variables', () => {
      const logs = `
        Error: Environment variable 'DATABASE_URL' is not defined
          at validateEnv (/app/src/config.js:10:11)
          at Object.<anonymous> (/app/src/index.js:5:1)
      `;

      const result = classifier.classify(logs);

      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      // Find the environment error
      const envError = result.errors.find((e) => e.category === ErrorCategory.ENVIRONMENT);
      expect(envError).toBeDefined();
      expect(envError?.severity).toBe(ErrorSeverity.CRITICAL);
      expect(envError?.metadata?.capture_0_1).toBe('DATABASE_URL');
    });

    it('should classify database connection errors', () => {
      const logs = `
        Error: connect ECONNREFUSED 127.0.0.1:5432
          at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1141:16)
        PostgreSQL connection failed
      `;

      const result = classifier.classify(logs);

      expect(result.errors.length).toBeGreaterThan(0);
      const dbError = result.errors.find((e) => e.category === ErrorCategory.DATABASE);
      expect(dbError).toBeDefined();
      expect(dbError?.severity).toBe(ErrorSeverity.CRITICAL);
    });
  });

  describe('Classification Options', () => {
    it('should filter by severity', () => {
      const logs = `
        Error: Critical build failure
        Warning: Unused variable 'x'
        Info: Starting build process
      `;

      const options: ClassificationOptions = {
        severityFilter: [ErrorSeverity.CRITICAL, ErrorSeverity.HIGH],
      };

      classifier.setOptions(options);
      const result = classifier.classify(logs);

      result.errors.forEach((error) => {
        expect([ErrorSeverity.CRITICAL, ErrorSeverity.HIGH]).toContain(error.severity);
      });
    });

    it('should respect minimum confidence threshold', () => {
      const logs = `
        Some generic error occurred
        Specific TypeScript error TS2322: Type mismatch
      `;

      const options: ClassificationOptions = {
        minConfidence: 0.8,
      };

      classifier.setOptions(options);
      const result = classifier.classify(logs);

      result.errors.forEach((error) => {
        expect(error.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('should limit maximum errors', () => {
      const logs = `
        Error 1: Test failed
        Error 2: Build failed
        Error 3: Lint failed
        Error 4: Type check failed
        Error 5: Coverage failed
      `;

      const options: ClassificationOptions = {
        maxErrors: 3,
      };

      classifier.setOptions(options);
      const result = classifier.classify(logs);

      expect(result.errors.length).toBeLessThanOrEqual(3);
    });

    it('should deduplicate similar errors', () => {
      const logs = `
        TypeError: Cannot read property 'name' of undefined at line 10
        TypeError: Cannot read property 'name' of undefined at line 20
        TypeError: Cannot read property 'name' of undefined at line 30
      `;

      const options: ClassificationOptions = {
        deduplication: true,
      };

      classifier.setOptions(options);
      const result = classifier.classify(logs);

      expect(result.errors.length).toBe(1);
    });
  });

  describe('Context Extraction', () => {
    it('should extract file and line information', () => {
      const logs = `
        at processTicksAndRejections (/app/src/utils/helper.js:125:7)
        at async handleRequest (/app/src/server.js:45:12)
      `;

      const result = classifier.classify(logs);

      if (result.errors.length > 0) {
        const context = result.errors[0].context;
        expect(context.file).toBeDefined();
        expect(context.line).toBeDefined();
        expect(context.column).toBeDefined();
      }
    });

    it('should extract stack trace', () => {
      const logs = `
        Error: Something went wrong
          at functionA (/app/src/a.js:10:5)
          at functionB (/app/src/b.js:20:10)
          at functionC (/app/src/c.js:30:15)
      `;

      const options: ClassificationOptions = {
        includeContext: true,
      };

      classifier.setOptions(options);
      const result = classifier.classify(logs);

      if (result.errors.length > 0) {
        expect(result.errors[0].context.stackTrace).toBeDefined();
        expect(result.errors[0].context.stackTrace?.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Confidence Scoring', () => {
    it('should assign higher confidence to exact pattern matches', () => {
      const logs = `
        FATAL ERROR: JavaScript heap out of memory
      `;

      const result = classifier.classify(logs);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].confidence).toBeGreaterThan(0.9);
    });

    it('should assign lower confidence to generic errors', () => {
      const logs = `
        Error occurred
      `;

      const result = classifier.classify(logs);

      if (result.errors.length > 0) {
        expect(result.errors[0].confidence).toBeLessThan(0.5);
      }
    });
  });

  describe('Summary Statistics', () => {
    it('should provide accurate summary counts', () => {
      const logs = `
        FATAL ERROR: Out of memory
        TypeError: Cannot read property 'x' of null
        Warning: Deprecated API usage
        FAIL src/test.spec.ts
      `;

      const result = classifier.classify(logs);

      expect(result.summary.total).toBe(result.errors.length);
      expect(result.summary.criticalCount).toBe(
        result.errors.filter((e) => e.severity === ErrorSeverity.CRITICAL).length
      );
      expect(result.summary.highCount).toBe(
        result.errors.filter((e) => e.severity === ErrorSeverity.HIGH).length
      );
    });

    it('should group errors by category', () => {
      const logs = `
        TypeError: undefined is not a function
        Cannot find module 'express'
        Test failed: Expected true to be false
      `;

      const result = classifier.classify(logs);

      expect(result.summary.byCategory).toBeDefined();
      const totalByCategory = Object.values(result.summary.byCategory).reduce(
        (sum, count) => sum + count,
        0
      );
      expect(totalByCategory).toBe(result.errors.length);
    });
  });

  describe('Custom Patterns', () => {
    it('should allow adding custom patterns', () => {
      const customPattern = {
        id: 'custom-error',
        category: ErrorCategory.RUNTIME,
        severity: ErrorSeverity.HIGH,
        patterns: [/CUSTOM_ERROR:\s+(.+)/],
        description: 'Custom application error',
        commonCauses: ['Application-specific issue'],
        suggestedFixes: ['Check application logs'],
        confidence: 0.95,
      };

      classifier.addPatterns([customPattern]);

      const logs = 'CUSTOM_ERROR: Something specific went wrong';
      const result = classifier.classify(logs);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].patterns).toContain('custom-error');
    });

    it('should allow removing patterns', () => {
      classifier.removePatterns(['ts-syntax-error']);

      const logs = 'error TS2322: Type error';
      const result = classifier.classify(logs);

      const tsError = result.errors.find((e) => e.patterns.includes('ts-syntax-error'));
      expect(tsError).toBeUndefined();
    });
  });
});
