import { createLogger, format, transports, addColors, Logform } from 'winston';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

addColors(colors);

// Format for console output
const consoleFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.colorize({ all: true }),
  format.printf(
    (info: Logform.TransformableInfo) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Format for file output
const fileFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

// Create the logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: fileFormat,
  transports: [
    // Console transport
    new transports.Console({
      format: consoleFormat,
    }),
    // Error file transport
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined file transport
    new transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add HTTP request logging
export interface LogContext {
  userId?: string;
  organizationId?: string;
  requestId?: string;
  method?: string;
  url?: string;
  ip?: string;
  userAgent?: string;
  correlationId?: string;
  [key: string]: string | undefined;
}

export class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  private formatMessage(message: string, meta?: unknown): string {
    const contextStr = Object.keys(this.context).length ? ` [${JSON.stringify(this.context)}]` : '';
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `${message}${contextStr}${metaStr}`;
  }

  error(message: string, error?: Error | unknown, meta?: unknown): void {
    const errorMeta =
      error instanceof Error
        ? { error: { message: error.message, stack: error.stack } }
        : error
          ? { error }
          : {};
    const combinedMeta =
      meta && typeof meta === 'object' && !Array.isArray(meta)
        ? { ...errorMeta, ...meta }
        : errorMeta;
    logger.error(this.formatMessage(message, combinedMeta));
  }

  warn(message: string, meta?: unknown): void {
    logger.warn(this.formatMessage(message, meta));
  }

  info(message: string, meta?: unknown): void {
    logger.info(this.formatMessage(message, meta));
  }

  http(message: string, meta?: unknown): void {
    logger.http(this.formatMessage(message, meta));
  }

  debug(message: string, meta?: unknown): void {
    logger.debug(this.formatMessage(message, meta));
  }

  // Create a child logger with additional context
  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  // Note: Express request logger has been removed. Use Next.js request context instead.
}

// Export a default logger instance
export const defaultLogger = new Logger();

// Export the winston logger for advanced usage
export { logger as winstonLogger };
