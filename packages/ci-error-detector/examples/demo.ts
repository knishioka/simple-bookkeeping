/**
 * CI Error Detector Demo
 *
 * This example demonstrates the capabilities of the CI error detector
 */

import { CIErrorClassifier, formatError } from '../src';

// Example CI logs with various error types
const exampleLogs = `
##[group]Run npm test
npm ERR! code ELIFECYCLE
npm ERR! errno 1

> simple-bookkeeping@1.0.0 test
> jest --coverage

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
      28 | });

    at Object.<anonymous> (src/components/Button.test.tsx:27:30)

src/utils/calculator.ts:42:10 - error TS2322: Type 'string' is not assignable to type 'number'.

42          return "0";
            ~~~~~~~~~~~

  src/utils/calculator.ts:35:5 - error TS7006: Parameter 'value' implicitly has an 'any' type.

  35     (value) => value * 2
         ~~~~~

Error: Cannot find module 'express'
Require stack:
- /app/src/server.js
- /app/src/index.js
  at Function.Module._resolveFilename (internal/modules/cjs/loader.js:815:15)
  at Function.Module._load (internal/modules/cjs/loader.js:667:27)

TypeError: Cannot read property 'user' of undefined
  at authenticateRequest (/app/src/middleware/auth.js:15:23)
  at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)

Error: Environment variable 'DATABASE_URL' is not defined
  at validateEnv (/app/src/config.js:10:11)
  at Object.<anonymous> (/app/src/index.js:5:1)

Error: connect ECONNREFUSED 127.0.0.1:5432
  at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1141:16)
PostgreSQL connection failed

FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
1: 0x10123456 node::Abort() [/usr/local/bin/node]
2: 0x10123457 node::OnFatalError() [/usr/local/bin/node]

Test Suites: 3 failed, 12 passed, 15 total
Tests:       8 failed, 145 passed, 153 total
Snapshots:   2 failed, 18 passed, 20 total
Time:        45.231s
`;

function demo() {
  console.log('🔍 CI Error Detector Demo\n');
  console.log('='.repeat(80));

  // Create classifier with options
  const classifier = new CIErrorClassifier(undefined, {
    includeContext: true,
    minConfidence: 0.5,
    deduplication: true,
  });

  // Classify errors
  console.log('📊 Analyzing CI logs...\n');
  const startTime = Date.now();
  const result = classifier.classify(exampleLogs);
  console.log(`✅ Analysis complete in ${Date.now() - startTime}ms\n`);

  // Display summary
  console.log('📈 Summary:');
  console.log(`  Total errors found: ${result.summary.total}`);
  console.log(`  Critical errors: ${result.summary.criticalCount}`);
  console.log(`  High priority errors: ${result.summary.highCount}`);
  console.log(`  Overall confidence: ${(result.confidence * 100).toFixed(1)}%\n`);

  // Display errors by category
  console.log('📂 Errors by Category:');
  Object.entries(result.summary.byCategory).forEach(([category, count]) => {
    if (count > 0) {
      console.log(`  ${category}: ${count}`);
    }
  });
  console.log();

  // Display errors by severity
  console.log('⚠️  Errors by Severity:');
  Object.entries(result.summary.bySeverity).forEach(([severity, count]) => {
    if (count > 0) {
      const icon =
        severity === 'critical'
          ? '🔴'
          : severity === 'high'
            ? '🟠'
            : severity === 'medium'
              ? '🟡'
              : severity === 'low'
                ? '🟢'
                : 'ℹ️';
      console.log(`  ${icon} ${severity.toUpperCase()}: ${count}`);
    }
  });
  console.log();

  // Display detailed errors
  console.log('='.repeat(80));
  console.log('📋 Detailed Error Analysis:\n');

  result.errors.slice(0, 5).forEach((error, index) => {
    console.log(`Error #${index + 1}`);
    console.log('-'.repeat(40));
    console.log(formatError(error));
    console.log();
  });

  if (result.errors.length > 5) {
    console.log(`... and ${result.errors.length - 5} more errors\n`);
  }

  // Demonstrate custom pattern
  console.log('='.repeat(80));
  console.log('🔧 Adding Custom Pattern:\n');

  classifier.addPatterns([
    {
      id: 'custom-deployment-error',
      category: 'deployment' as unknown as ErrorCategory,
      severity: 'critical' as unknown as ErrorSeverity,
      patterns: [/DEPLOYMENT FAILED:\s+(.+)/],
      description: 'Deployment failure',
      commonCauses: ['Build artifacts missing', 'Invalid configuration'],
      suggestedFixes: ['Check build logs', 'Verify deployment configuration'],
      confidence: 0.95,
    },
  ]);

  const deploymentLog = 'DEPLOYMENT FAILED: Unable to push to production';
  const deployResult = classifier.classify(deploymentLog);

  if (deployResult.errors.length > 0) {
    console.log('Custom pattern detected:');
    console.log(formatError(deployResult.errors[0]));
  }
}

// Run the demo
demo();
