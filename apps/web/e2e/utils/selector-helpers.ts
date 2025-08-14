/**
 * Optimized selectors for E2E tests
 * Issue #129: Optimize E2E test timeouts and execution speed
 *
 * Performance tips:
 * 1. Use data-testid for critical elements
 * 2. Prefer ID selectors over class/tag selectors
 * 3. Avoid complex CSS selectors
 * 4. Use specific role attributes
 */

/**
 * Test ID selectors (fastest)
 */
export const TestIds = {
  // Authentication
  loginForm: '[data-testid="login-form"]',
  emailInput: '[data-testid="email-input"]',
  passwordInput: '[data-testid="password-input"]',
  loginButton: '[data-testid="login-button"]',
  logoutButton: '[data-testid="logout-button"]',

  // Navigation
  navBar: '[data-testid="navbar"]',
  sideBar: '[data-testid="sidebar"]',
  dashboardLink: '[data-testid="dashboard-link"]',

  // Tables
  dataTable: '[data-testid="data-table"]',
  tableRow: '[data-testid="table-row"]',
  tableHeader: '[data-testid="table-header"]',

  // Forms
  form: '[data-testid="form"]',
  submitButton: '[data-testid="submit-button"]',
  cancelButton: '[data-testid="cancel-button"]',

  // Journal Entries
  journalTable: '[data-testid="journal-table"]',
  journalForm: '[data-testid="journal-form"]',
  journalEntry: '[data-testid="journal-entry"]',

  // Accounts
  accountsTable: '[data-testid="accounts-table"]',
  accountForm: '[data-testid="account-form"]',
  accountSelect: '[data-testid="account-select"]',

  // Audit Logs
  auditLogsTable: '[data-testid="audit-logs-table"]',
  auditLogEntry: '[data-testid="audit-log-entry"]',

  // Common UI Elements
  modal: '[data-testid="modal"]',
  toast: '[data-testid="toast"]',
  spinner: '[data-testid="spinner"]',
  errorMessage: '[data-testid="error-message"]',
  successMessage: '[data-testid="success-message"]',
} as const;

/**
 * Role-based selectors (semantic and accessible)
 */
export const RoleSelectors = {
  // Navigation
  navigation: '[role="navigation"]',
  banner: '[role="banner"]',
  main: '[role="main"]',

  // Interactive elements
  button: '[role="button"]',
  link: '[role="link"]',
  textbox: '[role="textbox"]',
  combobox: '[role="combobox"]',

  // Feedback
  alert: '[role="alert"]',
  status: '[role="status"]',
  dialog: '[role="dialog"]',

  // Data display
  table: '[role="table"]',
  row: '[role="row"]',
  cell: '[role="cell"]',
  columnheader: '[role="columnheader"]',
} as const;

/**
 * Optimized compound selectors
 */
export const CompoundSelectors = {
  // Form elements with specific types
  emailInput: 'input[type="email"], input#email, input[name="email"]',
  passwordInput: 'input[type="password"], input#password, input[name="password"]',
  submitButton: 'button[type="submit"]',

  // Table elements
  tableRows: 'tbody tr',
  tableHeaders: 'thead th',

  // Error states
  fieldError: '.field-error, [aria-invalid="true"]',
  formError: '.form-error, [role="alert"]',
} as const;

/**
 * Get selector by priority (performance optimized)
 * 1. Test ID (fastest)
 * 2. ID
 * 3. Role
 * 4. Data attribute
 * 5. Class (slowest)
 */
export function getOptimizedSelector(
  element: string,
  options?: {
    testId?: string;
    id?: string;
    role?: string;
    dataAttr?: string;
    className?: string;
  }
): string {
  if (options?.testId) {
    return `[data-testid="${options.testId}"]`;
  }
  if (options?.id) {
    return `#${options.id}`;
  }
  if (options?.role) {
    return `[role="${options.role}"]`;
  }
  if (options?.dataAttr) {
    return `[${options.dataAttr}]`;
  }
  if (options?.className) {
    return `.${options.className}`;
  }

  // Fallback to element tag
  return element;
}

/**
 * Build efficient XPath selector (use sparingly)
 */
export function buildXPath(text: string, element: string = '*'): string {
  return `//${element}[contains(text(), "${text}")]`;
}

/**
 * Get text-based selector (less performant, use as fallback)
 */
export function getTextSelector(text: string, exact: boolean = false): string {
  if (exact) {
    return `text="${text}"`;
  }
  return `text=/.*${text}.*/i`;
}
