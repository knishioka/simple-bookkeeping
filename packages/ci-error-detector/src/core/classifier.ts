/**
 * CI Error Classification Engine
 *
 * Core engine for classifying CI errors with confidence scoring
 */

import { allPatterns } from '../patterns';
import {
  ClassifiedError,
  ClassificationOptions,
  ClassificationResult,
  ErrorPattern,
  PatternMatch,
  ErrorCategory,
  ErrorSeverity,
} from '../types';
import { extractContext, deduplicateErrors } from '../utils';

export class CIErrorClassifier {
  private patterns: ErrorPattern[];
  private options: ClassificationOptions;

  constructor(patterns: ErrorPattern[] = allPatterns, options: ClassificationOptions = {}) {
    this.patterns = patterns;
    this.options = {
      includeContext: true,
      minConfidence: 0.3,
      deduplication: true,
      enhancedMatching: false,
      ...options,
    };
  }

  /**
   * Classify errors from CI logs
   */
  classify(logs: string): ClassificationResult {
    const startTime = Date.now();
    const lines = logs.split('\n');
    const errors: ClassifiedError[] = [];
    const processedErrors = new Set<string>();

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const context = this.getLineContext(lines, i);

      // Try to match against all patterns
      const matches = this.matchPatterns(line, context);

      for (const match of matches) {
        // Check confidence threshold
        if (match.confidence < (this.options.minConfidence || 0)) {
          continue;
        }

        // Check for duplicates
        const errorHash = this.hashError(line, match.pattern.id);
        if (this.options.deduplication && processedErrors.has(errorHash)) {
          continue;
        }
        processedErrors.add(errorHash);

        // Create classified error
        const classifiedError = this.createClassifiedError(line, match, context, i);

        // Apply filters
        if (this.shouldIncludeError(classifiedError)) {
          errors.push(classifiedError);
        }

        // Check max errors limit
        if (this.options.maxErrors && errors.length >= this.options.maxErrors) {
          break;
        }
      }
    }

    // Deduplicate if needed
    const finalErrors = this.options.deduplication ? deduplicateErrors(errors) : errors;

    // Sort by severity and confidence
    finalErrors.sort((a, b) => {
      const severityOrder = {
        [ErrorSeverity.CRITICAL]: 0,
        [ErrorSeverity.HIGH]: 1,
        [ErrorSeverity.MEDIUM]: 2,
        [ErrorSeverity.LOW]: 3,
        [ErrorSeverity.INFO]: 4,
      };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.confidence - a.confidence;
    });

    return this.createResult(finalErrors, Date.now() - startTime);
  }

  /**
   * Match patterns against a line
   */
  private matchPatterns(line: string, context: string[]): PatternMatch[] {
    const matches: PatternMatch[] = [];

    for (const pattern of this.patterns) {
      const patternMatches: RegExpMatchArray[] = [];
      let highestConfidence = 0;

      // Try each regex pattern
      for (const regex of pattern.patterns) {
        const match = line.match(regex);
        if (match) {
          patternMatches.push(match);
          // Calculate pattern-specific confidence
          const confidence = this.calculatePatternConfidence(pattern, match, line, context);
          highestConfidence = Math.max(highestConfidence, confidence);
        }
      }

      if (patternMatches.length > 0) {
        matches.push({
          pattern,
          matches: patternMatches,
          confidence: highestConfidence,
          extractedData: this.extractDataFromMatches(patternMatches),
        });
      }
    }

    return matches;
  }

  /**
   * Calculate confidence for a specific pattern match
   */
  private calculatePatternConfidence(
    pattern: ErrorPattern,
    match: RegExpMatchArray,
    line: string,
    context: string[]
  ): number {
    let confidence = pattern.confidence || 0.7;

    // Boost confidence for exact matches
    if (match[0] === line.trim()) {
      confidence *= 1.2;
    }

    // Boost confidence if multiple patterns from same category match in context
    const contextMatches = context.filter((contextLine) =>
      pattern.patterns.some((regex) => regex.test(contextLine))
    ).length;
    if (contextMatches > 1) {
      confidence *= 1 + contextMatches * 0.1;
    }

    // Reduce confidence for generic patterns
    if (line.length < 20 || match[0].length < 10) {
      confidence *= 0.8;
    }

    // Apply enhanced matching if enabled
    if (this.options.enhancedMatching) {
      confidence = this.enhanceConfidence(pattern, line, context, confidence);
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Enhance confidence using additional heuristics
   */
  private enhanceConfidence(
    pattern: ErrorPattern,
    line: string,
    context: string[],
    baseConfidence: number
  ): number {
    let confidence = baseConfidence;

    // Check for keywords that indicate this type of error
    const keywords = this.getKeywordsForCategory(pattern.category);
    const keywordCount = keywords.filter((kw) =>
      line.toLowerCase().includes(kw.toLowerCase())
    ).length;
    confidence *= 1 + keywordCount * 0.05;

    // Check for file extensions that match the error type
    const fileExtensions = this.getFileExtensionsForCategory(pattern.category);
    const hasRelevantFile = fileExtensions.some((ext) => line.includes(`.${ext}`));
    if (hasRelevantFile) {
      confidence *= 1.1;
    }

    // Check for stack trace patterns
    if (this.hasStackTracePattern(context)) {
      confidence *= 1.15;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Get keywords associated with an error category
   */
  private getKeywordsForCategory(category: ErrorCategory): string[] {
    const keywordMap: Partial<Record<ErrorCategory, string[]>> = {
      [ErrorCategory.SYNTAX]: ['syntax', 'parse', 'unexpected', 'token'],
      [ErrorCategory.TYPE]: ['type', 'assignable', 'property', 'undefined'],
      [ErrorCategory.RUNTIME]: ['runtime', 'undefined', 'null', 'error'],
      [ErrorCategory.TEST_FAILURE]: ['test', 'expect', 'fail', 'assert'],
      [ErrorCategory.DEPENDENCY]: ['module', 'package', 'dependency', 'install'],
      [ErrorCategory.NETWORK]: ['network', 'connection', 'timeout', 'refused'],
      [ErrorCategory.DATABASE]: ['database', 'query', 'connection', 'transaction'],
      [ErrorCategory.AUTHENTICATION]: ['auth', 'token', 'unauthorized', 'forbidden'],
    };
    return keywordMap[category] || [];
  }

  /**
   * Get file extensions associated with an error category
   */
  private getFileExtensionsForCategory(category: ErrorCategory): string[] {
    const extensionMap: Partial<Record<ErrorCategory, string[]>> = {
      [ErrorCategory.SYNTAX]: ['ts', 'tsx', 'js', 'jsx'],
      [ErrorCategory.TYPE]: ['ts', 'tsx', 'd.ts'],
      [ErrorCategory.TEST_FAILURE]: ['test.ts', 'spec.ts', 'test.js', 'spec.js'],
      [ErrorCategory.BUILD]: ['json', 'config.js', 'config.ts'],
      [ErrorCategory.DEPENDENCY]: ['json', 'lock', 'yaml'],
    };
    return extensionMap[category] || [];
  }

  /**
   * Check if context contains stack trace pattern
   */
  private hasStackTracePattern(context: string[]): boolean {
    const stackTracePatterns = [
      /^\s*at\s+/,
      /^\s+\w+\.\w+\s*\(/,
      /:\d+:\d+/,
      /^\s*File\s+"[^"]+",\s+line\s+\d+/,
    ];
    return context.some((line) => stackTracePatterns.some((pattern) => pattern.test(line)));
  }

  /**
   * Get context lines around current line
   */
  private getLineContext(lines: string[], index: number, contextSize = 3): string[] {
    const start = Math.max(0, index - contextSize);
    const end = Math.min(lines.length, index + contextSize + 1);
    return lines.slice(start, end);
  }

  /**
   * Create a classified error object
   */
  private createClassifiedError(
    line: string,
    match: PatternMatch,
    contextLines: string[],
    lineNumber: number
  ): ClassifiedError {
    const context = this.options.includeContext
      ? extractContext(contextLines.join('\n'), lineNumber)
      : {};

    return {
      id: this.generateErrorId(),
      category: match.pattern.category,
      severity: match.pattern.severity,
      confidence: match.confidence,
      message: this.extractErrorMessage(line, match),
      rawError: line,
      context: {
        ...context,
        line: lineNumber + 1,
      },
      patterns: [match.pattern.id],
      suggestedFixes: match.pattern.suggestedFixes,
      metadata: match.extractedData,
    };
  }

  /**
   * Extract error message from line and match
   */
  private extractErrorMessage(line: string, match: PatternMatch): string {
    // Try to extract the most relevant part of the error
    if (match.matches.length > 0 && match.matches[0].length > 1) {
      // Use first capture group if available
      return match.matches[0][1] || line.trim();
    }
    return line.trim();
  }

  /**
   * Extract data from regex matches
   */
  private extractDataFromMatches(matches: RegExpMatchArray[]): Record<string, string> {
    const data: Record<string, string> = {};

    matches.forEach((match, index) => {
      if (match.length > 1) {
        // Extract capture groups
        for (let i = 1; i < match.length; i++) {
          if (match[i]) {
            data[`capture_${index}_${i}`] = match[i];
          }
        }
      }
    });

    return data;
  }

  /**
   * Check if error should be included based on filters
   */
  private shouldIncludeError(error: ClassifiedError): boolean {
    // Check severity filter
    if (this.options.severityFilter && this.options.severityFilter.length > 0) {
      if (!this.options.severityFilter.includes(error.severity)) {
        return false;
      }
    }

    // Check category filter
    if (this.options.categoryFilter && this.options.categoryFilter.length > 0) {
      if (!this.options.categoryFilter.includes(error.category)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create classification result
   */
  private createResult(errors: ClassifiedError[], processingTime: number): ClassificationResult {
    const summary = {
      total: errors.length,
      bySeverity: this.countBySeverity(errors),
      byCategory: this.countByCategory(errors),
      criticalCount: errors.filter((e) => e.severity === ErrorSeverity.CRITICAL).length,
      highCount: errors.filter((e) => e.severity === ErrorSeverity.HIGH).length,
    };

    const overallConfidence =
      errors.length > 0 ? errors.reduce((sum, e) => sum + e.confidence, 0) / errors.length : 0;

    return {
      errors,
      summary,
      confidence: overallConfidence,
      processingTime,
    };
  }

  /**
   * Count errors by severity
   */
  private countBySeverity(errors: ClassifiedError[]): Record<ErrorSeverity, number> {
    const counts: Record<ErrorSeverity, number> = {
      [ErrorSeverity.CRITICAL]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.INFO]: 0,
    };

    errors.forEach((error) => {
      counts[error.severity]++;
    });

    return counts;
  }

  /**
   * Count errors by category
   */
  private countByCategory(errors: ClassifiedError[]): Record<ErrorCategory, number> {
    const counts: Partial<Record<ErrorCategory, number>> = {};

    errors.forEach((error) => {
      counts[error.category] = (counts[error.category] || 0) + 1;
    });

    return counts as Record<ErrorCategory, number>;
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create hash for error deduplication
   */
  private hashError(line: string, patternId: string): string {
    // Simple hash based on cleaned line and pattern
    const cleanedLine = line.replace(/\d+/g, 'N').replace(/\s+/g, ' ').trim();
    return `${patternId}:${cleanedLine.substring(0, 100)}`;
  }

  /**
   * Update classification options
   */
  setOptions(options: Partial<ClassificationOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Add custom patterns
   */
  addPatterns(patterns: ErrorPattern[]): void {
    this.patterns.push(...patterns);
  }

  /**
   * Remove patterns by ID
   */
  removePatterns(patternIds: string[]): void {
    this.patterns = this.patterns.filter((p) => !patternIds.includes(p.id));
  }
}
