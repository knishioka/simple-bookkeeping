/**
 * Syntax and Compilation Error Patterns
 */

import { ErrorPattern, ErrorCategory, ErrorSeverity } from '../types';

export const syntaxPatterns: ErrorPattern[] = [
  {
    id: 'ts-syntax-error',
    category: ErrorCategory.SYNTAX,
    severity: ErrorSeverity.CRITICAL,
    patterns: [
      /TS\d+:\s+(.+)/,
      /error TS(\d+):\s*(.+)/,
      /SyntaxError:\s+(.+)/,
      /Unexpected token\s+['"`]?(\w+)['"`]?/,
      /Expected\s+['"`]?(.+?)['"`]?\s+but found\s+['"`]?(.+?)['"`]?/,
    ],
    description: 'TypeScript syntax or compilation error',
    commonCauses: [
      'Missing semicolons or brackets',
      'Invalid TypeScript syntax',
      'Incorrect type annotations',
      'Missing or extra commas in objects/arrays',
    ],
    suggestedFixes: [
      'Check for missing closing brackets or parentheses',
      'Verify TypeScript syntax is valid',
      'Run tsc locally to identify the exact error',
      'Check for recent changes in the affected files',
    ],
    confidence: 0.95,
  },

  {
    id: 'jsx-syntax-error',
    category: ErrorCategory.SYNTAX,
    severity: ErrorSeverity.CRITICAL,
    patterns: [
      /JSX element\s+(.+?)\s+has no corresponding closing tag/,
      /Adjacent JSX elements must be wrapped in an enclosing tag/,
      /JSX expressions must have one parent element/,
      /Unterminated JSX contents/,
    ],
    description: 'JSX/React syntax error',
    commonCauses: [
      'Unclosed JSX tags',
      'Multiple root elements without fragment',
      'Missing closing tags',
      'Invalid JSX syntax',
    ],
    suggestedFixes: [
      'Ensure all JSX tags are properly closed',
      'Wrap multiple elements in a React.Fragment or <div>',
      'Check for missing angle brackets in JSX',
      'Verify JSX syntax in the affected component',
    ],
    confidence: 0.95,
  },

  {
    id: 'import-error',
    category: ErrorCategory.MODULE_NOT_FOUND,
    severity: ErrorSeverity.CRITICAL,
    patterns: [
      /Cannot find module\s+['"`](.+?)['"`]/,
      /Module not found.*Can't resolve\s+['"`](.+?)['"`]/,
      /Failed to resolve import\s+["'](.+?)["']/,
      /Unable to resolve path to module\s+['"`](.+?)['"`]/,
    ],
    description: 'Module import or resolution error',
    commonCauses: [
      'Missing npm dependency',
      'Incorrect import path',
      'Module not installed',
      'Case sensitivity in import paths',
      'Missing file extension in import',
    ],
    suggestedFixes: [
      'Run npm/pnpm install to install dependencies',
      'Check if the import path is correct',
      'Verify the module exists in node_modules',
      'Check for case sensitivity in file names',
      'Add appropriate file extensions to imports',
    ],
    confidence: 0.9,
  },

  {
    id: 'eslint-error',
    category: ErrorCategory.LINT,
    severity: ErrorSeverity.MEDIUM,
    patterns: [
      // eslint-disable-next-line security/detect-unsafe-regex -- bounded pattern for ESLint error format
      /\s+(\d+):(\d+)\s+error\s+([^\s]+)\s+(@?\w+(?:\/[\w-]+)?)/,
      /ESLint:\s+(.+)/,
      /Parsing error:\s+(.+)/,
    ],
    description: 'ESLint linting error',
    commonCauses: [
      'Code style violations',
      'Unused variables or imports',
      'Missing return statements',
      'Incorrect hook usage in React',
    ],
    suggestedFixes: [
      'Run eslint --fix to auto-fix issues',
      'Review ESLint rules in .eslintrc',
      'Fix the specific linting issues mentioned',
      'Update code to match project style guide',
    ],
    confidence: 0.85,
  },

  {
    id: 'type-error',
    category: ErrorCategory.TYPE,
    severity: ErrorSeverity.HIGH,
    patterns: [
      /Type\s+'(.+?)'\s+is not assignable to type\s+'(.+?)'/,
      /Property\s+'(.+?)'\s+does not exist on type\s+'(.+?)'/,
      /Argument of type\s+'(.+?)'\s+is not assignable to parameter of type\s+'(.+?)'/,
      /Object is possibly\s+'(null|undefined)'/,
      /Cannot invoke an object which is possibly\s+'undefined'/,
    ],
    description: 'TypeScript type error',
    commonCauses: [
      'Type mismatch in assignments',
      'Missing properties in objects',
      'Incorrect function arguments',
      'Null/undefined not handled properly',
      'Incorrect type assertions',
    ],
    suggestedFixes: [
      'Check type definitions and ensure compatibility',
      'Add missing properties to objects',
      'Verify function signatures match usage',
      'Add null/undefined checks',
      'Update or fix type annotations',
    ],
    confidence: 0.9,
  },

  {
    id: 'json-parse-error',
    category: ErrorCategory.SYNTAX,
    severity: ErrorSeverity.HIGH,
    patterns: [
      /JSON\.parse.*SyntaxError/,
      /Unexpected token\s+(\w)\s+in JSON at position\s+(\d+)/,
      /Invalid JSON/,
      /JSON Parse error:\s+(.+)/,
    ],
    description: 'JSON parsing error',
    commonCauses: [
      'Invalid JSON syntax',
      'Trailing commas in JSON',
      'Single quotes instead of double quotes',
      'Unescaped special characters',
      'Comments in JSON files',
    ],
    suggestedFixes: [
      'Validate JSON syntax using a JSON validator',
      'Remove trailing commas from JSON objects/arrays',
      'Use double quotes for strings in JSON',
      'Remove comments from JSON files',
      'Escape special characters properly',
    ],
    confidence: 0.95,
  },

  {
    id: 'async-await-error',
    category: ErrorCategory.SYNTAX,
    severity: ErrorSeverity.HIGH,
    patterns: [
      /await is only valid in async function/,
      /Cannot use keyword 'await' outside an async function/,
      /The operand of an? 'await' expression must be a Promise/,
    ],
    description: 'Async/await syntax error',
    commonCauses: [
      'Using await outside async function',
      'Missing async keyword on function',
      'Awaiting non-promise value',
    ],
    suggestedFixes: [
      'Add async keyword to the containing function',
      'Ensure the awaited value returns a Promise',
      'Remove await if not needed',
      'Wrap in an async IIFE if needed',
    ],
    confidence: 0.95,
  },
];
