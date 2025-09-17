/**
 * Utility functions for CI error detection and classification
 */

import {
  ErrorContext,
  ClassifiedError,
  ErrorSeverity,
  FlakyTest,
  ErrorTrend,
  ErrorCategory,
} from '../types';

/**
 * Extract context information from error logs
 */
export function extractContext(logs: string, lineNumber?: number): ErrorContext {
  const context: ErrorContext = {};
  const lines = logs.split('\n');

  // Extract file path
  const fileMatch = logs.match(/(?:at\s+)?(?:file:\/\/)?([/\w\-_.]+\.\w+):(\d+):(\d+)/);
  if (fileMatch) {
    context.file = fileMatch[1];
    context.line = parseInt(fileMatch[2], 10);
    context.column = parseInt(fileMatch[3], 10);
  }

  // Extract function name
  const functionMatch = logs.match(/at\s+([\w.<>]+)\s*\(/);
  if (functionMatch) {
    context.function = functionMatch[1];
  }

  // Extract stack trace
  const stackLines = lines.filter((line) => /^\s*at\s+/.test(line));
  if (stackLines.length > 0) {
    context.stackTrace = stackLines.slice(0, 10); // Limit to 10 lines
  }

  // Extract workflow step (GitHub Actions specific)
  const stepMatch = logs.match(/##\[group\]Run\s+(.+)/);
  if (stepMatch) {
    context.workflowStep = stepMatch[1];
  }

  // Extract job name
  const jobMatch = logs.match(/Job:\s*(.+)/);
  if (jobMatch) {
    context.jobName = jobMatch[1];
  }

  // Extract timestamp
  const timeMatch = logs.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  if (timeMatch) {
    context.timestamp = timeMatch[0];
  }

  // Extract code snippet around error
  if (lineNumber !== undefined && lines[lineNumber]) {
    const start = Math.max(0, lineNumber - 2);
    const end = Math.min(lines.length, lineNumber + 3);
    context.codeSnippet = lines.slice(start, end).join('\n');
  }

  return context;
}

/**
 * Calculate confidence score based on multiple factors
 */
export function calculateConfidence(
  matchCount: number,
  patternSpecificity: number,
  contextRelevance: number = 0.5
): number {
  // Base confidence from match count (more matches = higher confidence)
  const matchConfidence = Math.min(1, matchCount * 0.3);

  // Weight factors
  const weights = {
    match: 0.4,
    specificity: 0.4,
    context: 0.2,
  };

  const confidence =
    matchConfidence * weights.match +
    patternSpecificity * weights.specificity +
    contextRelevance * weights.context;

  return Math.min(1, Math.max(0, confidence));
}

/**
 * Deduplicate similar errors
 */
export function deduplicateErrors(errors: ClassifiedError[]): ClassifiedError[] {
  const uniqueErrors = new Map<string, ClassifiedError>();

  for (const error of errors) {
    const key = generateErrorKey(error);
    const existing = uniqueErrors.get(key);

    if (!existing || error.confidence > existing.confidence) {
      uniqueErrors.set(key, error);
    } else if (existing && error.confidence === existing.confidence) {
      // Merge suggested fixes
      existing.suggestedFixes = [...new Set([...existing.suggestedFixes, ...error.suggestedFixes])];
    }
  }

  return Array.from(uniqueErrors.values());
}

/**
 * Generate a unique key for error deduplication
 */
function generateErrorKey(error: ClassifiedError): string {
  // Create key from category, severity, and normalized message
  const normalizedMessage = error.message
    .replace(/\d+/g, 'N') // Replace numbers
    .replace(/['"`]/g, '') // Remove quotes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .substring(0, 100); // Limit length

  return `${error.category}:${error.severity}:${normalizedMessage}`;
}

/**
 * Group errors by category
 */
export function groupErrorsByCategory(
  errors: ClassifiedError[]
): Map<ErrorCategory, ClassifiedError[]> {
  const grouped = new Map<ErrorCategory, ClassifiedError[]>();

  for (const error of errors) {
    const existing = grouped.get(error.category) || [];
    existing.push(error);
    grouped.set(error.category, existing);
  }

  return grouped;
}

/**
 * Sort errors by priority (severity and confidence)
 */
export function sortErrorsByPriority(errors: ClassifiedError[]): ClassifiedError[] {
  const severityOrder: Record<ErrorSeverity, number> = {
    [ErrorSeverity.CRITICAL]: 0,
    [ErrorSeverity.HIGH]: 1,
    [ErrorSeverity.MEDIUM]: 2,
    [ErrorSeverity.LOW]: 3,
    [ErrorSeverity.INFO]: 4,
  };

  return [...errors].sort((a, b) => {
    // First sort by severity
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;

    // Then by confidence
    return b.confidence - a.confidence;
  });
}

/**
 * Detect flaky tests from error history
 */
export function detectFlakyTests(
  testErrors: Array<{ testName: string; failed: boolean; timestamp: string }>
): FlakyTest[] {
  const testStats = new Map<
    string,
    {
      failures: number;
      total: number;
      lastFailure?: string;
    }
  >();

  // Collect statistics
  for (const test of testErrors) {
    const stats = testStats.get(test.testName) || { failures: 0, total: 0 };
    stats.total++;
    if (test.failed) {
      stats.failures++;
      stats.lastFailure = test.timestamp;
    }
    testStats.set(test.testName, stats);
  }

  // Identify flaky tests
  const flakyTests: FlakyTest[] = [];
  for (const [testName, stats] of testStats.entries()) {
    const failureRate = stats.failures / stats.total;

    // Consider a test flaky if it fails 10-90% of the time
    const isFlaky = failureRate > 0.1 && failureRate < 0.9;

    // Calculate confidence based on number of runs
    const confidence = Math.min(1, stats.total / 20); // Full confidence at 20+ runs

    flakyTests.push({
      testName,
      failureRate,
      recentFailures: stats.failures,
      totalRuns: stats.total,
      lastFailure: stats.lastFailure,
      isFlaky,
      confidence,
    });
  }

  return flakyTests.filter((test) => test.isFlaky);
}

/**
 * Analyze error trends over time
 */
export function analyzeErrorTrends(
  errors: Array<{ category: ErrorCategory; timestamp: string }>
): ErrorTrend[] {
  // Group by time buckets (e.g., daily)
  const buckets = new Map<string, Map<ErrorCategory, number>>();

  for (const error of errors) {
    const date = error.timestamp.split('T')[0]; // Get date part
    const dateBucket = buckets.get(date) || new Map<ErrorCategory, number>();
    const count = dateBucket.get(error.category) || 0;
    dateBucket.set(error.category, count + 1);
    buckets.set(date, dateBucket);
  }

  // Convert to timeline
  const sortedDates = Array.from(buckets.keys()).sort();
  const categories = new Set<ErrorCategory>();

  for (const bucket of buckets.values()) {
    for (const category of bucket.keys()) {
      categories.add(category);
    }
  }

  // Build trends
  const trends: ErrorTrend[] = [];

  for (const category of categories) {
    const timestamps: string[] = [];
    const occurrences: number[] = [];

    for (const date of sortedDates) {
      timestamps.push(date);
      occurrences.push(buckets.get(date)?.get(category) || 0);
    }

    // Calculate trend
    const trend = calculateTrend(occurrences);
    const changeRate = calculateChangeRate(occurrences);

    trends.push({
      category,
      occurrences,
      timestamps,
      trend,
      changeRate,
    });
  }

  return trends;
}

/**
 * Calculate trend direction
 */
function calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
  if (values.length < 2) return 'stable';

  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const difference = secondAvg - firstAvg;
  const threshold = 0.1 * firstAvg; // 10% change threshold

  if (difference > threshold) return 'increasing';
  if (difference < -threshold) return 'decreasing';
  return 'stable';
}

/**
 * Calculate percentage change rate
 */
function calculateChangeRate(values: number[]): number {
  if (values.length < 2) return 0;

  const first = values[0] || 1; // Avoid division by zero
  const last = values[values.length - 1];

  return ((last - first) / first) * 100;
}

/**
 * Format error for human-readable output
 */
export function formatError(error: ClassifiedError): string {
  const lines: string[] = [];

  lines.push(`[${error.severity.toUpperCase()}] ${error.category}`);
  lines.push(`Message: ${error.message}`);
  lines.push(`Confidence: ${(error.confidence * 100).toFixed(1)}%`);

  if (error.context.file) {
    lines.push(`File: ${error.context.file}:${error.context.line}:${error.context.column}`);
  }

  if (error.suggestedFixes.length > 0) {
    lines.push('Suggested fixes:');
    error.suggestedFixes.forEach((fix) => {
      lines.push(`  - ${fix}`);
    });
  }

  return lines.join('\n');
}

/**
 * Parse CI log timestamps
 */
export function parseTimestamp(logLine: string): Date | null {
  // Common timestamp patterns
  const patterns = [
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/, // ISO 8601
    /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/, // Standard format
    /\[\d{2}:\d{2}:\d{2}\]/, // Time only in brackets
    /\d{2}:\d{2}:\d{2}\.\d{3}/, // Time with milliseconds
  ];

  for (const pattern of patterns) {
    const match = logLine.match(pattern);
    if (match) {
      try {
        return new Date(match[0]);
      } catch {
        continue;
      }
    }
  }

  return null;
}

/**
 * Extract error location from stack trace
 */
export function extractErrorLocation(stackTrace: string[]): {
  file?: string;
  line?: number;
  column?: number;
  function?: string;
} | null {
  if (!stackTrace || stackTrace.length === 0) return null;

  for (const line of stackTrace) {
    const match = line.match(/at\s+(?:(.+?)\s+\()?([^:]+):(\d+):(\d+)\)?/);
    if (match) {
      return {
        function: match[1],
        file: match[2],
        line: parseInt(match[3], 10),
        column: parseInt(match[4], 10),
      };
    }
  }

  return null;
}

/**
 * Sanitize error messages for security
 */
export function sanitizeErrorMessage(message: string): string {
  // Remove potential sensitive information
  return message
    .replace(/Bearer\s+[\w-]+/gi, 'Bearer [REDACTED]') // API tokens
    .replace(/jwt\s+[\w-]+\.[\w-]+\.[\w-]+/gi, 'jwt=[REDACTED]') // JWT tokens
    .replace(/oauth[\s:=]+["']?[\w-]+/gi, 'oauth=[REDACTED]') // OAuth tokens
    .replace(/api[_-]?key["\s:=]+["']?[\w-]+/gi, 'api_key=[REDACTED]') // API keys
    .replace(/password["\s:=]+["']?[^"'\s]+/gi, 'password=[REDACTED]') // Passwords
    .replace(/secret["\s:=]+["']?[\w-]+/gi, 'secret=[REDACTED]') // Secrets
    .replace(/\b[\w._%+-]+@[\w.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]') // Email addresses
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]') // IP addresses
    .replace(/\/home\/[\w.-]+(?:\/[\w.-]+)*/g, '/home/[USER]') // User home paths
    .replace(/\/Users\/[\w.-]+(?:\/[\w.-]+)*/g, '/Users/[USER]'); // macOS user paths - more precise pattern
}
