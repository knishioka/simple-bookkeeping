/**
 * Environment-aware logger for development debugging
 * In production, info/warn/debug are no-ops to prevent information disclosure
 * Only errors are logged in production for critical issues
 */

const isDevelopment = process.env.NODE_ENV === 'development';

function info(...args: unknown[]): void {
  if (isDevelopment) {
    // eslint-disable-next-line no-console
    console.info(...args);
  }
}

function warn(...args: unknown[]): void {
  if (isDevelopment) {
    console.warn(...args);
  }
}

function debug(...args: unknown[]): void {
  if (isDevelopment) {
    // eslint-disable-next-line no-console
    console.debug(...args);
  }
}

function error(...args: unknown[]): void {
  // Always log errors, even in production
  console.error(...args);
}

export const logger = {
  info,
  warn,
  debug,
  error,
} as const;

export type Logger = typeof logger;
