import { createCacheManager, metrics, healthChecker } from '@simple-bookkeeping/shared';
import { Router, Request, Response } from 'express';

import { prisma } from '../lib/prisma';

const router = Router();

/**
 * @swagger
 * /api/v1/metrics:
 *   get:
 *     summary: Get Prometheus metrics
 *     description: Expose application metrics in Prometheus format
 *     tags: [Monitoring]
 *     security: []
 *     responses:
 *       200:
 *         description: Prometheus metrics
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', metrics.getContentType());
    res.send(await metrics.getMetrics());
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'METRICS_ERROR',
        message: 'Failed to collect metrics',
      },
    });
  }
});

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Health check endpoint
 *     description: Get detailed health status of the application
 *     tags: [Monitoring]
 *     security: []
 *     responses:
 *       200:
 *         description: Application is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, unhealthy, degraded]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Uptime in seconds
 *                 checks:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: boolean
 *                         latency:
 *                           type: number
 *                         error:
 *                           type: string
 *                     cache:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: boolean
 *                         latency:
 *                           type: number
 *                         error:
 *                           type: string
 *                     memory:
 *                       type: object
 *                       properties:
 *                         used:
 *                           type: number
 *                         total:
 *                           type: number
 *                         percentage:
 *                           type: number
 *       503:
 *         description: Service unavailable
 */
router.get('/health', async (_req: Request, res: Response) => {
  const health = await healthChecker.checkHealth(
    // Database check
    async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return true;
      } catch {
        return false;
      }
    },
    // Cache check
    async () => {
      try {
        const cache = createCacheManager();
        return cache.isConnected();
      } catch {
        return false;
      }
    }
  );

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * @swagger
 * /api/v1/health/liveness:
 *   get:
 *     summary: Kubernetes liveness probe
 *     description: Simple liveness check for container orchestration
 *     tags: [Monitoring]
 *     security: []
 *     responses:
 *       200:
 *         description: Application is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 */
router.get('/health/liveness', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

/**
 * @swagger
 * /api/v1/health/readiness:
 *   get:
 *     summary: Kubernetes readiness probe
 *     description: Check if application is ready to serve traffic
 *     tags: [Monitoring]
 *     security: []
 *     responses:
 *       200:
 *         description: Application is ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ready
 *                 database:
 *                   type: boolean
 *       503:
 *         description: Application not ready
 */
router.get('/health/readiness', async (_req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'ready',
      database: true,
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      database: false,
      error: 'Database connection failed',
    });
  }
});

export default router;
