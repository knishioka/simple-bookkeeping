# CI Error Detector

A comprehensive error detection and classification system for CI/CD pipelines. This package provides intelligent error pattern matching, classification with confidence scoring, and actionable fix suggestions.

## Features

- **Comprehensive Error Patterns**: 30+ predefined patterns covering TypeScript, runtime, test, and environment errors
- **Confidence Scoring**: Each classification includes a confidence score (0-1) based on pattern matching quality
- **Context Extraction**: Automatically extracts file paths, line numbers, stack traces, and more
- **Deduplication**: Intelligent deduplication of similar errors
- **Trend Analysis**: Analyze error trends over time to identify increasing issues
- **Flaky Test Detection**: Identify tests that fail intermittently
- **Security**: Automatic sanitization of sensitive information in error messages

## Installation

```bash
npm install @simple-bookkeeping/ci-error-detector
# or
pnpm add @simple-bookkeeping/ci-error-detector
```

## Quick Start

```typescript
import { CIErrorClassifier } from '@simple-bookkeeping/ci-error-detector';

// Create classifier instance
const classifier = new CIErrorClassifier();

// Classify errors from CI logs
const ciLogs = `
  Error: Cannot find module 'express'
  TypeError: Cannot read property 'name' of undefined
  FAIL src/app.test.ts
`;

const result = classifier.classify(ciLogs);

// Access classification results
console.log(`Found ${result.errors.length} errors`);
console.log(`Critical errors: ${result.summary.criticalCount}`);

// Display errors with suggested fixes
result.errors.forEach((error) => {
  console.log(`[${error.severity}] ${error.category}: ${error.message}`);
  console.log(`Confidence: ${(error.confidence * 100).toFixed(1)}%`);

  if (error.suggestedFixes.length > 0) {
    console.log('Suggested fixes:');
    error.suggestedFixes.forEach((fix) => console.log(`  - ${fix}`));
  }
});
```

## Error Categories

The classifier recognizes the following error categories:

- **Syntax**: Syntax and parsing errors
- **Type**: TypeScript type errors
- **Runtime**: Runtime execution errors
- **Test Failure**: Unit and E2E test failures
- **Dependency**: Package and module resolution errors
- **Environment**: Environment variable and configuration errors
- **Database**: Database connection and query errors
- **Network**: Network and API errors
- **Security**: Authentication and authorization errors
- **Build**: Build and compilation errors

## Classification Options

Customize classification behavior with options:

```typescript
const classifier = new CIErrorClassifier(undefined, {
  includeContext: true, // Include detailed context (default: true)
  minConfidence: 0.5, // Minimum confidence threshold (default: 0.3)
  deduplication: true, // Deduplicate similar errors (default: true)
  maxErrors: 100, // Maximum errors to return
  severityFilter: ['critical', 'high'], // Filter by severity
  categoryFilter: ['runtime', 'test_failure'], // Filter by category
});
```

## Advanced Usage

### Custom Error Patterns

Add your own error patterns:

```typescript
import { ErrorPattern, ErrorCategory, ErrorSeverity } from '@simple-bookkeeping/ci-error-detector';

const customPattern: ErrorPattern = {
  id: 'custom-api-error',
  category: ErrorCategory.NETWORK,
  severity: ErrorSeverity.HIGH,
  patterns: [/API_ERROR:\s+(\d{3})\s+-\s+(.+)/, /Custom API failed with code (\d+)/],
  description: 'Custom API error',
  commonCauses: ['API service down', 'Invalid API key'],
  suggestedFixes: ['Check API service status', 'Verify API credentials'],
  confidence: 0.9,
};

classifier.addPatterns([customPattern]);
```

### Flaky Test Detection

Identify tests that fail intermittently:

```typescript
import { detectFlakyTests } from '@simple-bookkeeping/ci-error-detector';

const testHistory = [
  { testName: 'login.test.ts', failed: true, timestamp: '2024-01-01' },
  { testName: 'login.test.ts', failed: false, timestamp: '2024-01-02' },
  { testName: 'login.test.ts', failed: true, timestamp: '2024-01-03' },
];

const flakyTests = detectFlakyTests(testHistory);
flakyTests.forEach((test) => {
  if (test.isFlaky) {
    console.log(
      `Flaky test: ${test.testName} (${(test.failureRate * 100).toFixed(0)}% failure rate)`
    );
  }
});
```

### Error Trend Analysis

Analyze error trends over time:

```typescript
import { analyzeErrorTrends } from '@simple-bookkeeping/ci-error-detector';

const errorHistory = [
  { category: ErrorCategory.RUNTIME, timestamp: '2024-01-01T00:00:00Z' },
  { category: ErrorCategory.RUNTIME, timestamp: '2024-01-02T00:00:00Z' },
  { category: ErrorCategory.RUNTIME, timestamp: '2024-01-03T00:00:00Z' },
];

const trends = analyzeErrorTrends(errorHistory);
trends.forEach((trend) => {
  console.log(`${trend.category}: ${trend.trend} (${trend.changeRate.toFixed(1)}% change)`);
});
```

### Utility Functions

The package provides various utility functions:

```typescript
import {
  extractContext,
  sanitizeErrorMessage,
  sortErrorsByPriority,
  groupErrorsByCategory,
} from '@simple-bookkeeping/ci-error-detector';

// Extract context from logs
const context = extractContext(logString);

// Sanitize sensitive information
const safe = sanitizeErrorMessage('Bearer token123 failed');
// Returns: 'Bearer [REDACTED] failed'

// Sort errors by priority
const sorted = sortErrorsByPriority(errors);

// Group by category
const grouped = groupErrorsByCategory(errors);
```

## API Reference

### CIErrorClassifier

Main classifier class for error detection and classification.

#### Methods

- `classify(logs: string): ClassificationResult` - Classify errors from log text
- `setOptions(options: ClassificationOptions)` - Update classification options
- `addPatterns(patterns: ErrorPattern[])` - Add custom error patterns
- `removePatterns(patternIds: string[])` - Remove patterns by ID

### Types

```typescript
interface ClassificationResult {
  errors: ClassifiedError[];
  summary: {
    total: number;
    bySeverity: Record<ErrorSeverity, number>;
    byCategory: Record<ErrorCategory, number>;
    criticalCount: number;
    highCount: number;
  };
  confidence: number;
  processingTime: number;
}

interface ClassifiedError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  confidence: number;
  message: string;
  rawError: string;
  context: ErrorContext;
  patterns: string[];
  suggestedFixes: string[];
}
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
- name: Analyze CI Errors
  if: failure()
  run: |
    npm install @simple-bookkeeping/ci-error-detector
    node -e "
      const { CIErrorClassifier } = require('@simple-bookkeeping/ci-error-detector');
      const fs = require('fs');

      const logs = fs.readFileSync('${{ runner.temp }}/logs.txt', 'utf8');
      const classifier = new CIErrorClassifier();
      const result = classifier.classify(logs);

      console.log(JSON.stringify(result, null, 2));
    "
```

## Contributing

Contributions are welcome! Please see the main project's contributing guidelines.

## License

MIT
