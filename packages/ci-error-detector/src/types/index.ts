/**
 * CI Error Detection and Classification Type Definitions
 *
 * This module defines the core types and interfaces for the CI error
 * detection and classification system.
 */

/**
 * Severity levels for CI errors
 */
export enum ErrorSeverity {
  CRITICAL = 'critical', // Build/deployment blocking errors
  HIGH = 'high', // Test failures, significant issues
  MEDIUM = 'medium', // Warnings that should be addressed
  LOW = 'low', // Minor issues, style violations
  INFO = 'info', // Informational messages
}

/**
 * Categories of CI errors for classification
 */
export enum ErrorCategory {
  // Build and Compilation
  SYNTAX = 'syntax',
  TYPE = 'type',
  BUILD = 'build',
  COMPILATION = 'compilation',

  // Runtime and Execution
  RUNTIME = 'runtime',
  MEMORY = 'memory',
  TIMEOUT = 'timeout',

  // Testing
  TEST_FAILURE = 'test_failure',
  TEST_TIMEOUT = 'test_timeout',
  TEST_SETUP = 'test_setup',

  // Dependencies and Environment
  DEPENDENCY = 'dependency',
  MODULE_NOT_FOUND = 'module_not_found',
  VERSION_MISMATCH = 'version_mismatch',
  ENVIRONMENT = 'environment',

  // Security and Authentication
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  SECURITY = 'security',

  // Infrastructure
  NETWORK = 'network',
  DATABASE = 'database',
  CONTAINER = 'container',
  DEPLOYMENT = 'deployment',

  // Code Quality
  LINT = 'lint',
  FORMATTING = 'formatting',

  // Other
  UNKNOWN = 'unknown',
}

/**
 * Represents a pattern for matching CI errors
 */
export interface ErrorPattern {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  patterns: RegExp[];
  description: string;
  commonCauses: string[];
  suggestedFixes: string[];
  documentation?: string;
  confidence?: number; // Base confidence for this pattern (0-1)
}

/**
 * Context information extracted from CI logs
 */
export interface ErrorContext {
  file?: string;
  line?: number;
  column?: number;
  function?: string;
  stackTrace?: string[];
  codeSnippet?: string;
  workflowStep?: string;
  jobName?: string;
  runner?: string;
  timestamp?: string;
}

/**
 * Represents a classified CI error
 */
export interface ClassifiedError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  confidence: number; // 0-1 confidence score
  message: string;
  rawError: string;
  context: ErrorContext;
  patterns: string[]; // IDs of matched patterns
  suggestedFixes: string[];
  relatedErrors?: string[]; // IDs of related errors
  metadata?: Record<string, unknown>;
}

/**
 * Classification result with all detected errors
 */
export interface ClassificationResult {
  errors: ClassifiedError[];
  summary: {
    total: number;
    bySeverity: Record<ErrorSeverity, number>;
    byCategory: Record<ErrorCategory, number>;
    criticalCount: number;
    highCount: number;
  };
  confidence: number; // Overall classification confidence
  processingTime: number; // ms
  metadata?: {
    workflow?: string;
    repository?: string;
    branch?: string;
    commit?: string;
    runId?: string;
    runUrl?: string;
  };
}

/**
 * Options for error classification
 */
export interface ClassificationOptions {
  includeContext?: boolean;
  minConfidence?: number; // Minimum confidence threshold (0-1)
  severityFilter?: ErrorSeverity[];
  categoryFilter?: ErrorCategory[];
  maxErrors?: number;
  deduplication?: boolean;
  enhancedMatching?: boolean; // Use ML-based matching
}

/**
 * Pattern matching result
 */
export interface PatternMatch {
  pattern: ErrorPattern;
  matches: RegExpMatchArray[];
  confidence: number;
  extractedData?: Record<string, string>;
}

/**
 * Error fix suggestion with confidence
 */
export interface FixSuggestion {
  description: string;
  commands?: string[];
  confidence: number;
  automated?: boolean;
  documentation?: string;
  estimatedTime?: string;
}

/**
 * Represents a CI job or workflow run
 */
export interface CIRun {
  id: string;
  status: 'success' | 'failure' | 'cancelled' | 'in_progress';
  workflow: string;
  jobs: CIJob[];
  startTime: string;
  endTime?: string;
  duration?: number;
  url?: string;
  logs?: string;
}

/**
 * Represents a single CI job
 */
export interface CIJob {
  id: string;
  name: string;
  status: 'success' | 'failure' | 'skipped' | 'cancelled';
  steps: CIStep[];
  runner?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  logs?: string;
}

/**
 * Represents a step in a CI job
 */
export interface CIStep {
  id: string;
  name: string;
  status: 'success' | 'failure' | 'skipped';
  output?: string;
  error?: string;
  exitCode?: number;
  startTime?: string;
  endTime?: string;
  duration?: number;
}

/**
 * Statistics for error classification performance
 */
export interface ClassificationStats {
  totalProcessed: number;
  successfulClassifications: number;
  failedClassifications: number;
  averageConfidence: number;
  averageProcessingTime: number;
  patternHitRate: Record<string, number>;
}

/**
 * Error trend analysis
 */
export interface ErrorTrend {
  category: ErrorCategory;
  occurrences: number[];
  timestamps: string[];
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number; // Percentage change
}

/**
 * Flaky test detection
 */
export interface FlakyTest {
  testName: string;
  filePath?: string;
  failureRate: number; // 0-1
  recentFailures: number;
  totalRuns: number;
  lastFailure?: string;
  isFlaky: boolean;
  confidence: number;
}
