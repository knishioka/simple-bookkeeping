/**
 * Central registry of all error patterns
 */

import { ErrorPattern } from '../types';

import { environmentPatterns } from './environment-patterns';
import { runtimePatterns } from './runtime-patterns';
import { syntaxPatterns } from './syntax-patterns';
import { testPatterns } from './test-patterns';

// Combine all patterns
export const allPatterns: ErrorPattern[] = [
  ...syntaxPatterns,
  ...runtimePatterns,
  ...testPatterns,
  ...environmentPatterns,
];

// Export individual pattern groups for selective use
export { syntaxPatterns, runtimePatterns, testPatterns, environmentPatterns };

// Pattern lookup map for quick access
export const patternMap = new Map<string, ErrorPattern>(
  allPatterns.map((pattern) => [pattern.id, pattern])
);

/**
 * Get patterns by category
 */
export function getPatternsByCategory(category: string): ErrorPattern[] {
  return allPatterns.filter((pattern) => pattern.category === category);
}

/**
 * Get patterns by severity
 */
export function getPatternsBySeverity(severity: string): ErrorPattern[] {
  return allPatterns.filter((pattern) => pattern.severity === severity);
}

/**
 * Get pattern by ID
 */
export function getPatternById(id: string): ErrorPattern | undefined {
  return patternMap.get(id);
}
