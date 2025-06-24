import { OrganizationType } from '@simple-bookkeeping/database';
import { Router, Request, Response } from 'express';

import { prisma } from '../lib/prisma';

import type { Router as RouterType } from 'express';

const router: RouterType = Router();

// Development endpoint to check database schema
router.get('/check-schema', async (_req: Request, res: Response) => {
  try {
    // Check if new columns exist by trying a simple query
    const testAccount = await prisma.account.findFirst({
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        organizationType: true,
      },
    });

    // Get database statistics
    const counts = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.account.count(),
      prisma.accountingPeriod.count(),
    ]);

    res.json({
      data: {
        schemaStatus: 'OK',
        hasNewFields: testAccount !== null || true,
        stats: {
          users: counts[0],
          organizations: counts[1],
          accounts: counts[2],
          accountingPeriods: counts[3],
        },
        sampleAccount: testAccount,
        organizationTypes: Object.values(OrganizationType),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: 'SCHEMA_CHECK_ERROR',
        message: error.message || 'スキーマチェック中にエラーが発生しました',
        details: error.toString(),
      },
    });
  }
});

// Development endpoint to create test data
router.post('/create-test-account', async (req: Request, res: Response) => {
  try {
    // Get first organization
    const organization = await prisma.organization.findFirst();

    if (!organization) {
      return res.status(400).json({
        error: {
          code: 'NO_ORGANIZATION',
          message: '組織が存在しません',
        },
      });
    }

    // Create a test account with new fields
    const account = await prisma.account.create({
      data: {
        code: `TEST-${Date.now()}`,
        name: 'テスト勘定科目',
        description: 'スキーマテスト用の勘定科目',
        accountType: 'ASSET',
        organizationType: OrganizationType.BOTH,
        organizationId: organization.id,
        isSystem: false,
      },
    });

    res.json({
      data: {
        message: 'テスト勘定科目を作成しました',
        account,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: 'CREATE_TEST_ERROR',
        message: error.message || 'テストデータ作成中にエラーが発生しました',
        details: error.toString(),
      },
    });
  }
});

export default router;
