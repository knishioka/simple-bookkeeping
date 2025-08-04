import {
  DEFAULT_API_PORT,
  REQUEST_BODY_SIZE_LIMIT,
  defaultLogger,
  metricsMiddleware,
  databaseMonitor,
  performDatabaseHealthCheck,
} from '@simple-bookkeeping/shared';
import cors from 'cors';
import { config } from 'dotenv';
import express, { Express, json, urlencoded } from 'express';
import helmet from 'helmet';
import passport from 'passport';
import swaggerUi from 'swagger-ui-express';

import { jwtStrategy } from './config/passport';
import { swaggerSpec } from './config/swagger';
import { databaseMetricsMiddleware } from './middlewares/database.middleware';
import {
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  performanceMiddleware,
} from './middlewares/logging.middleware';
import {
  rateLimiters,
  speedLimiters,
  securityHeaders,
  sanitizeInput,
  sqlInjectionProtection,
} from './middlewares/security.middleware';
import routes from './routes';

config();

const app: Express = express();
const PORT = process.env.PORT || process.env.API_PORT || DEFAULT_API_PORT;

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // In development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) || [];

    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    // Check if origin is in allowed list
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Also allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    // Allow Vercel deployments
    if (origin.includes('vercel.app')) {
      return callback(null, true);
    }

    // If CORS_ORIGIN is not set, allow Vercel deployments as fallback
    if (!process.env.CORS_ORIGIN && origin.includes('vercel.app')) {
      defaultLogger.info('CORS_ORIGIN not set, allowing Vercel deployment', { origin });
      return callback(null, true);
    }

    defaultLogger.warn('CORS request blocked', { origin, allowedOrigins });
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id'],
  exposedHeaders: ['X-Total-Count'],
};

// Security middleware
app.use(helmet());
app.use(securityHeaders);
app.use(cors(corsOptions));

// Rate limiting
app.use('/api/v1/auth', rateLimiters.auth, speedLimiters.auth);
app.use('/api/v1', rateLimiters.api);

// Logging middleware (before body parsing)
app.use(requestLoggingMiddleware);
app.use(performanceMiddleware);
app.use(metricsMiddleware);
app.use(databaseMetricsMiddleware);

// Body parsing middleware
app.use(json({ limit: REQUEST_BODY_SIZE_LIMIT }));
app.use(urlencoded({ extended: true, limit: REQUEST_BODY_SIZE_LIMIT }));

// Input sanitization and validation
app.use(sanitizeInput);
app.use(sqlInjectionProtection);

// Passport
passport.use(jwtStrategy);
app.use(passport.initialize());

// Health check endpoints
app.get('/health', async (_req, res) => {
  const { checkDatabaseHealth, getConnectionPoolMetrics } = await import('./lib/prisma');
  const dbHealth = await performDatabaseHealthCheck(checkDatabaseHealth, getConnectionPoolMetrics);

  res.json({
    status: dbHealth.connected ? 'ok' : 'unhealthy',
    timestamp: new Date().toISOString(),
    database: dbHealth,
  });
});

app.get('/api/v1/health', async (_req, res) => {
  const { checkDatabaseHealth, getConnectionPoolMetrics } = await import('./lib/prisma');
  const dbHealth = await performDatabaseHealthCheck(checkDatabaseHealth, getConnectionPoolMetrics);

  res.json({
    status: dbHealth.connected ? 'ok' : 'unhealthy',
    timestamp: new Date().toISOString(),
    database: dbHealth,
  });
});

// API Documentation
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Simple Bookkeeping API Documentation',
    })
  );
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  defaultLogger.info('Swagger documentation available at /api-docs');
}

// API routes
app.use('/api/v1', routes);

// Error logging middleware (before error handler)
app.use(errorLoggingMiddleware);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong!',
    },
  });
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    defaultLogger.info(`Server is running on port ${PORT}`, {
      env: process.env.NODE_ENV,
      port: PORT,
      cors: corsOptions.origin,
    });

    // Configure and start database monitoring
    const { checkDatabaseHealth, getConnectionPoolMetrics, warmupConnectionPool } = await import(
      './lib/prisma'
    );
    databaseMonitor.configure(checkDatabaseHealth, getConnectionPoolMetrics);
    databaseMonitor.start();

    // Warmup database connections
    await warmupConnectionPool();
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    defaultLogger.info('SIGTERM received, shutting down gracefully...');
    databaseMonitor.stop();
  });
}

export default app;
