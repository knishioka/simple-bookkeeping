import { UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';
import { Router, Request, Response } from 'express';

import { prisma } from '../lib/prisma';

const router = Router();

// 初回セットアップ用のエンドポイント
// SETUP_TOKEN環境変数が設定されている場合のみ有効
router.post('/initialize', async (req: Request, res: Response) => {
  try {
    // セットアップトークンの検証
    const setupToken = process.env.SETUP_TOKEN;
    const providedToken = req.headers['x-setup-token'];

    if (!setupToken || setupToken !== providedToken) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Invalid setup token',
        },
      });
    }

    // すでにユーザーが存在する場合はエラー
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      return res.status(400).json({
        error: {
          code: 'ALREADY_INITIALIZED',
          message: 'Database is already initialized',
        },
      });
    }

    // 初期管理者ユーザーの作成
    const hashedPassword = await hash('admin123', 10);
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        passwordHash: hashedPassword,
        name: '管理者',
      },
    });

    // デフォルト組織の作成
    const organization = await prisma.organization.create({
      data: {
        name: 'サンプル会社',
        code: 'SAMPLE',
        email: 'info@sample.co.jp',
      },
    });

    // ユーザーと組織の関連付け
    await prisma.userOrganization.create({
      data: {
        userId: adminUser.id,
        organizationId: organization.id,
        role: UserRole.ADMIN,
        isDefault: true,
      },
    });

    // 会計期間の作成
    const currentYear = new Date().getFullYear();
    await prisma.accountingPeriod.create({
      data: {
        name: `${currentYear}年度`,
        startDate: new Date(currentYear, 0, 1),
        endDate: new Date(currentYear, 11, 31),
        isActive: true,
        organizationId: organization.id,
      },
    });

    res.json({
      data: {
        message: 'Initial setup completed successfully',
        admin: {
          email: adminUser.email,
          name: adminUser.name,
        },
        organization: {
          name: organization.name,
          code: organization.code,
        },
      },
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({
      error: {
        code: 'SETUP_ERROR',
        message: 'Failed to initialize database',
      },
    });
  }
});

export default router;
