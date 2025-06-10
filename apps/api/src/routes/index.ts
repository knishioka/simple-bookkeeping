import { Router } from 'express';

import accountsRoutes from './accounts.routes';
import authRoutes from './auth.routes';
import journalEntriesRoutes from './journalEntries.routes';
import organizationsRoutes from './organizations.routes';
import reportsRoutes from './reports.routes';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/organizations', organizationsRoutes);
router.use('/accounts', accountsRoutes);
router.use('/journal-entries', journalEntriesRoutes);
router.use('/reports', reportsRoutes);

// Base route
router.get('/', (req, res) => {
  res.json({
    message: 'Simple Bookkeeping API',
    version: '1.0.0',
  });
});

export default router;
