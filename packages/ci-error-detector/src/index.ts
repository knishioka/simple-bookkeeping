/**
 * CI Error Detector - Main Entry Point
 *
 * A comprehensive error detection and classification system for CI/CD pipelines
 */

// Export all types
export * from './types';

// Export patterns
export * from './patterns';

// Export classifier
export { CIErrorClassifier } from './core/classifier';

// Export utilities
export * from './utils';

// Default export for convenience
import { CIErrorClassifier } from './core/classifier';
export default CIErrorClassifier;
