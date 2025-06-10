import { Router } from 'express';

import accountsRoutes from './accounts.routes';
import authRoutes from './auth.routes';
import journalEntriesRoutes from './journalEntries.routes';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/accounts', accountsRoutes);
router.use('/journal-entries', journalEntriesRoutes);

// Base route
router.get('/', (req, res) => {
  res.json({
    message: 'Simple Bookkeeping API',
    version: '1.0.0',
  });
});

export default router;
