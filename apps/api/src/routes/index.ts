import { Router } from 'express';

import accountsRoutes from './accounts.routes';
import authRoutes from './auth.routes';
import journalEntriesRoutes from './journalEntries.routes';
import ledgersRoutes from './ledgers.routes';
import monitoringRoutes from './monitoring.routes';
import organizationsRoutes from './organizations.routes';
import reportsRoutes from './reports.routes';
import seedRoutes from './seed.routes';
import setupRoutes from './setup.routes';

import type { Router as RouterType } from 'express';

const router: RouterType = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/setup', setupRoutes);
router.use('/organizations', organizationsRoutes);
router.use('/accounts', accountsRoutes);
router.use('/journal-entries', journalEntriesRoutes);
router.use('/reports', reportsRoutes);
router.use('/ledgers', ledgersRoutes);
router.use('/seed', seedRoutes);

// Monitoring routes (no auth required)
router.use('/', monitoringRoutes);

// Base route
router.get('/', (_req, res) => {
  res.json({
    message: 'Simple Bookkeeping API',
    version: '1.0.0',
  });
});

export default router;
