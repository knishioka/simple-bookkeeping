/**
 * Runtime and Execution Error Patterns
 */

import { ErrorPattern, ErrorCategory, ErrorSeverity } from '../types';

export const runtimePatterns: ErrorPattern[] = [
  {
    id: 'null-reference-error',
    category: ErrorCategory.RUNTIME,
    severity: ErrorSeverity.HIGH,
    patterns: [
      /Cannot read propert(?:y|ies)\s+['"`]?(.+?)['"`]?\s+of\s+(null|undefined)/,
      /Cannot access\s+['"`]?(.+?)['"`]?\s+of\s+(null|undefined)/,
      /TypeError:\s+(?:Cannot read|Cannot access)\s+.+\s+of\s+(null|undefined)/,
      /Uncaught TypeError:\s+.+\s+is not a function/,
    ],
    description: 'Null or undefined reference error',
    commonCauses: [
      'Accessing properties of null/undefined objects',
      'Missing null checks',
      'Asynchronous data not yet loaded',
      'Incorrect optional chaining usage',
    ],
    suggestedFixes: [
      'Add null/undefined checks before accessing properties',
      'Use optional chaining (?.) operator',
      'Initialize variables with default values',
      'Check async data loading state',
    ],
    confidence: 0.95,
  },

  {
    id: 'reference-error',
    category: ErrorCategory.RUNTIME,
    severity: ErrorSeverity.HIGH,
    patterns: [
      /ReferenceError:\s+(.+?)\s+is not defined/,
      /(.+?)\s+is not defined/,
      /Cannot access\s+'(.+?)'\s+before initialization/,
      /Temporal dead zone/,
    ],
    description: 'Variable reference error',
    commonCauses: [
      'Using undefined variables',
      'Typos in variable names',
      'Missing imports',
      'Temporal dead zone issues with let/const',
      'Incorrect scoping',
    ],
    suggestedFixes: [
      'Check variable spelling and declaration',
      'Ensure variables are imported/defined',
      'Check variable scope and hoisting',
      'Move variable declarations before usage',
    ],
    confidence: 0.9,
  },

  {
    id: 'timeout-error',
    category: ErrorCategory.TIMEOUT,
    severity: ErrorSeverity.HIGH,
    patterns: [
      /Timeout.*exceeded\s+(\d+)(?:ms|s)/,
      /Test timeout of\s+(\d+)ms exceeded/,
      /Async callback was not invoked within.*timeout/,
      /Operation timed out after\s+(\d+)/,
      /ETIMEDOUT/,
    ],
    description: 'Operation timeout error',
    commonCauses: [
      'Test taking too long to complete',
      'Network request timeout',
      'Infinite loops or long-running operations',
      'Slow external service responses',
      'Missing done() callback in async tests',
    ],
    suggestedFixes: [
      'Increase timeout threshold if necessary',
      'Optimize slow operations',
      'Add proper async/await handling',
      'Mock external services in tests',
      'Check for infinite loops',
    ],
    confidence: 0.95,
  },

  {
    id: 'memory-error',
    category: ErrorCategory.MEMORY,
    severity: ErrorSeverity.CRITICAL,
    patterns: [
      /JavaScript heap out of memory/,
      /FATAL ERROR:.*Allocation failed/,
      /Maximum call stack size exceeded/,
      /RangeError:\s+Maximum call stack/,
      /Out of memory/,
    ],
    description: 'Memory or stack overflow error',
    commonCauses: [
      'Memory leaks',
      'Infinite recursion',
      'Large data processing without pagination',
      'Circular dependencies',
      'Too many concurrent operations',
    ],
    suggestedFixes: [
      'Increase Node.js memory limit (--max-old-space-size)',
      'Check for infinite recursion',
      'Implement pagination for large datasets',
      'Fix circular dependencies',
      'Use streaming for large file processing',
    ],
    confidence: 1.0,
  },

  {
    id: 'promise-rejection',
    category: ErrorCategory.RUNTIME,
    severity: ErrorSeverity.HIGH,
    patterns: [
      /UnhandledPromiseRejection/,
      /Unhandled promise rejection/,
      /PromiseRejectionHandledWarning/,
      /Error:\s+Promise rejected with no error handler/,
    ],
    description: 'Unhandled promise rejection',
    commonCauses: [
      'Missing catch block for promises',
      'Missing try-catch for async/await',
      'Promise chain without error handling',
      'Async operations without proper error handling',
    ],
    suggestedFixes: [
      'Add .catch() to promise chains',
      'Use try-catch blocks with async/await',
      'Add global unhandledRejection handler',
      'Ensure all promises have error handling',
    ],
    confidence: 0.9,
  },

  {
    id: 'network-error',
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.HIGH,
    patterns: [
      /ECONNREFUSED/,
      /ENOTFOUND/,
      /ENETUNREACH/,
      /socket hang up/,
      /Network request failed/,
      /ERR_NETWORK/,
      /Failed to fetch/,
      /NetworkError/,
    ],
    description: 'Network connection error',
    commonCauses: [
      'Service not running or unreachable',
      'Incorrect URL or port',
      'Network connectivity issues',
      'Firewall blocking connections',
      'DNS resolution failures',
    ],
    suggestedFixes: [
      'Check if the service is running',
      'Verify URLs and ports are correct',
      'Check network connectivity',
      'Review firewall settings',
      'Check DNS configuration',
    ],
    confidence: 0.95,
  },

  {
    id: 'cors-error',
    category: ErrorCategory.SECURITY,
    severity: ErrorSeverity.HIGH,
    patterns: [
      /CORS/,
      /Cross-Origin Request Blocked/,
      /No 'Access-Control-Allow-Origin' header/,
      /CORS policy/,
      /Cross origin requests are only supported/,
    ],
    description: 'Cross-Origin Resource Sharing (CORS) error',
    commonCauses: [
      'Missing CORS headers on server',
      'Incorrect CORS configuration',
      'Different origins between client and server',
      'Credentials not properly handled',
    ],
    suggestedFixes: [
      'Configure CORS headers on the server',
      'Check allowed origins configuration',
      'Use proxy in development',
      'Ensure credentials are handled correctly',
    ],
    confidence: 0.95,
  },

  {
    id: 'file-not-found',
    category: ErrorCategory.RUNTIME,
    severity: ErrorSeverity.HIGH,
    patterns: [
      /ENOENT:\s+no such file or directory/,
      /File not found:\s+(.+)/,
      /Cannot find file:\s+(.+)/,
      /The system cannot find the file specified/,
    ],
    description: 'File not found error',
    commonCauses: [
      'Incorrect file path',
      'File does not exist',
      'Missing build artifacts',
      'Case sensitivity issues',
      'Wrong working directory',
    ],
    suggestedFixes: [
      'Verify the file path is correct',
      'Check if file exists at the specified location',
      'Ensure build step completed successfully',
      'Check for case sensitivity in file names',
      'Verify working directory is correct',
    ],
    confidence: 0.95,
  },
];
