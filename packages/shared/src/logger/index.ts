import { Request } from 'express';
import winston from 'winston';

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

winston.addColors(colors);

// Format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info: winston.Logform.TransformableInfo) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: fileFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // Error file transport
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined file transport
    new winston.transports.File({
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
  [key: string]: any;
}

export class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  private formatMessage(message: string, meta?: any): string {
    const contextStr = Object.keys(this.context).length ? ` [${JSON.stringify(this.context)}]` : '';
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `${message}${contextStr}${metaStr}`;
  }

  error(message: string, error?: Error | any, meta?: any): void {
    const errorMeta =
      error instanceof Error
        ? { error: { message: error.message, stack: error.stack } }
        : error
          ? { error }
          : {};
    logger.error(this.formatMessage(message, { ...errorMeta, ...meta }));
  }

  warn(message: string, meta?: any): void {
    logger.warn(this.formatMessage(message, meta));
  }

  info(message: string, meta?: any): void {
    logger.info(this.formatMessage(message, meta));
  }

  http(message: string, meta?: any): void {
    logger.http(this.formatMessage(message, meta));
  }

  debug(message: string, meta?: any): void {
    logger.debug(this.formatMessage(message, meta));
  }

  // Create a child logger with additional context
  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  // Create logger from Express request
  static fromRequest(req: Request & { user?: any; organizationId?: string }): Logger {
    return new Logger({
      userId: req.user?.id,
      organizationId: req.organizationId,
      requestId: req.headers['x-request-id'] as string,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}

// Export a default logger instance
export const defaultLogger = new Logger();

// Export the winston logger for advanced usage
export { logger as winstonLogger };
