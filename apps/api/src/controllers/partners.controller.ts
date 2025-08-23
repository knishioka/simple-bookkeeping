import { Logger } from '@simple-bookkeeping/shared';
import { PartnerType } from '@simple-bookkeeping/types';
import { Response } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middlewares/auth';

const logger = new Logger({ component: 'PartnersController' });

// Validation schemas
const createPartnerSchema = z.object({
  code: z.string().min(1, '取引先コードは必須です'),
  name: z.string().min(1, '取引先名は必須です'),
  nameKana: z.string().optional(),
  partnerType: z.enum(['CUSTOMER', 'VENDOR', 'BOTH']),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('正しいメールアドレスを入力してください').optional().or(z.literal('')),
  taxId: z.string().optional(),
});

const updatePartnerSchema = createPartnerSchema.partial().extend({
  isActive: z.boolean().optional(),
});

interface PartnerQuery {
  type?: PartnerType;
  active?: string;
  search?: string;
}

/**
 * @swagger
 * /api/v1/partners:
 *   get:
 *     summary: Get all partners
 *     description: Retrieve all partners for the current organization with optional filtering
 *     tags: [Partners]
 *     parameters:
 *       - $ref: '#/components/parameters/organizationId'
 *       - name: type
 *         in: query
 *         description: Filter by partner type
 *         schema:
 *           type: string
 *           enum: [CUSTOMER, VENDOR, BOTH]
 *       - name: active
 *         in: query
 *         description: Filter by active status
 *         schema:
 *           type: boolean
 *       - name: search
 *         in: query
 *         description: Search by name or code
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of partners
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Partner'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export const getPartners = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { type, active, search } = req.query as PartnerQuery;
    const organizationId = req.user?.organizationId;

    const where: Record<string, unknown> = {
      organizationId,
    };

    if (type) {
      where.partnerType = type;
    }

    if (active !== undefined) {
      where.isActive = active === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { nameKana: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const partners = await prisma.partner.findMany({
      where,
      orderBy: [{ partnerType: 'asc' }, { code: 'asc' }],
    });

    res.json({
      data: partners,
    });
  } catch (error) {
    logger.error('Get partners error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '取引先の取得中にエラーが発生しました',
      },
    });
  }
};

/**
 * @swagger
 * /api/v1/partners/{id}:
 *   get:
 *     summary: Get partner by ID
 *     description: Retrieve a specific partner by ID
 *     tags: [Partners]
 *     parameters:
 *       - $ref: '#/components/parameters/organizationId'
 *       - name: id
 *         in: path
 *         required: true
 *         description: Partner ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Partner details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Partner'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export const getPartnerById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    const partner = await prisma.partner.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!partner) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: '取引先が見つかりません',
        },
      });
      return;
    }

    res.json({
      data: partner,
    });
  } catch (error) {
    logger.error('Get partner by ID error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '取引先の取得中にエラーが発生しました',
      },
    });
  }
};

/**
 * @swagger
 * /api/v1/partners:
 *   post:
 *     summary: Create a new partner
 *     description: Create a new partner for the current organization
 *     tags: [Partners]
 *     parameters:
 *       - $ref: '#/components/parameters/organizationId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - name
 *               - partnerType
 *             properties:
 *               code:
 *                 type: string
 *                 description: Partner code (unique within organization)
 *               name:
 *                 type: string
 *                 description: Partner name
 *               nameKana:
 *                 type: string
 *                 description: Partner name in katakana
 *               partnerType:
 *                 type: string
 *                 enum: [CUSTOMER, VENDOR, BOTH]
 *                 description: Partner type
 *               address:
 *                 type: string
 *                 description: Partner address
 *               phone:
 *                 type: string
 *                 description: Partner phone number
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Partner email address
 *               taxId:
 *                 type: string
 *                 description: Tax identification number
 *     responses:
 *       201:
 *         description: Partner created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Partner'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export const createPartner = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      res.status(400).json({
        error: {
          code: 'ORGANIZATION_REQUIRED',
          message: '組織が選択されていません',
        },
      });
      return;
    }

    // Validate request body
    const validation = createPartnerSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力データが不正です',
          details: validation.error.flatten(),
        },
      });
      return;
    }

    const data = validation.data;

    // Check for duplicate code
    const existingPartner = await prisma.partner.findFirst({
      where: {
        code: data.code,
        organizationId,
      },
    });

    if (existingPartner) {
      res.status(409).json({
        error: {
          code: 'DUPLICATE_CODE',
          message: `取引先コード "${data.code}" は既に使用されています`,
        },
      });
      return;
    }

    // Create partner
    const partner = await prisma.partner.create({
      data: {
        ...data,
        email: data.email || null,
        organizationId,
      },
    });

    logger.info('Partner created', { partnerId: partner.id, code: partner.code });

    res.status(201).json({
      data: partner,
    });
  } catch (error) {
    logger.error('Create partner error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '取引先の作成中にエラーが発生しました',
      },
    });
  }
};

/**
 * @swagger
 * /api/v1/partners/{id}:
 *   put:
 *     summary: Update a partner
 *     description: Update an existing partner
 *     tags: [Partners]
 *     parameters:
 *       - $ref: '#/components/parameters/organizationId'
 *       - name: id
 *         in: path
 *         required: true
 *         description: Partner ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 description: Partner code
 *               name:
 *                 type: string
 *                 description: Partner name
 *               nameKana:
 *                 type: string
 *                 description: Partner name in katakana
 *               partnerType:
 *                 type: string
 *                 enum: [CUSTOMER, VENDOR, BOTH]
 *                 description: Partner type
 *               address:
 *                 type: string
 *                 description: Partner address
 *               phone:
 *                 type: string
 *                 description: Partner phone number
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Partner email address
 *               taxId:
 *                 type: string
 *                 description: Tax identification number
 *               isActive:
 *                 type: boolean
 *                 description: Active status
 *     responses:
 *       200:
 *         description: Partner updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Partner'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export const updatePartner = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    // Validate request body
    const validation = updatePartnerSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力データが不正です',
          details: validation.error.flatten(),
        },
      });
      return;
    }

    const data = validation.data;

    // Check if partner exists
    const existingPartner = await prisma.partner.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existingPartner) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: '取引先が見つかりません',
        },
      });
      return;
    }

    // Check for duplicate code if code is being changed
    if (data.code && data.code !== existingPartner.code) {
      const duplicatePartner = await prisma.partner.findFirst({
        where: {
          code: data.code,
          organizationId,
          NOT: { id },
        },
      });

      if (duplicatePartner) {
        res.status(409).json({
          error: {
            code: 'DUPLICATE_CODE',
            message: `取引先コード "${data.code}" は既に使用されています`,
          },
        });
        return;
      }
    }

    // Update partner
    const partner = await prisma.partner.update({
      where: { id },
      data: {
        ...data,
        email: data.email === '' ? null : data.email,
      },
    });

    logger.info('Partner updated', { partnerId: partner.id });

    res.json({
      data: partner,
    });
  } catch (error) {
    logger.error('Update partner error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '取引先の更新中にエラーが発生しました',
      },
    });
  }
};

/**
 * @swagger
 * /api/v1/partners/{id}:
 *   delete:
 *     summary: Delete a partner
 *     description: Soft delete a partner (sets isActive to false)
 *     tags: [Partners]
 *     parameters:
 *       - $ref: '#/components/parameters/organizationId'
 *       - name: id
 *         in: path
 *         required: true
 *         description: Partner ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Partner deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: '取引先を削除しました'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export const deletePartner = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    // Check if partner exists
    const partner = await prisma.partner.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!partner) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: '取引先が見つかりません',
        },
      });
      return;
    }

    // Check if partner has related journal entries
    const hasJournalEntries = await prisma.journalEntry.findFirst({
      where: {
        partnerId: id,
      },
    });

    if (hasJournalEntries) {
      res.status(409).json({
        error: {
          code: 'HAS_JOURNAL_ENTRIES',
          message: '仕訳が存在する取引先は削除できません',
        },
      });
      return;
    }

    // Soft delete partner
    await prisma.partner.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    logger.info('Partner deleted', { partnerId: id });

    res.json({
      message: '取引先を削除しました',
    });
  } catch (error) {
    logger.error('Delete partner error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '取引先の削除中にエラーが発生しました',
      },
    });
  }
};

/**
 * @swagger
 * /api/v1/partners/{id}/transactions:
 *   get:
 *     summary: Get partner transactions
 *     description: Retrieve all journal entries related to a specific partner
 *     tags: [Partners]
 *     parameters:
 *       - $ref: '#/components/parameters/organizationId'
 *       - name: id
 *         in: path
 *         required: true
 *         description: Partner ID
 *         schema:
 *           type: string
 *       - name: startDate
 *         in: query
 *         description: Start date for filtering transactions
 *         schema:
 *           type: string
 *           format: date
 *       - name: endDate
 *         in: query
 *         description: End date for filtering transactions
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of partner transactions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/JournalEntry'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export const getPartnerTransactions = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    const organizationId = req.user?.organizationId;

    // Check if partner exists
    const partner = await prisma.partner.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!partner) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: '取引先が見つかりません',
        },
      });
      return;
    }

    // Build query filters
    const where: Record<string, unknown> = {
      partnerId: id,
      organizationId,
    };

    if (startDate || endDate) {
      where.entryDate = {};
      if (startDate) {
        (where.entryDate as Record<string, unknown>).gte = new Date(startDate as string);
      }
      if (endDate) {
        (where.entryDate as Record<string, unknown>).lte = new Date(endDate as string);
      }
    }

    // Get transactions with related data
    const transactions = await prisma.journalEntry.findMany({
      where,
      include: {
        lines: {
          include: {
            account: true,
          },
        },
        accountingPeriod: true,
      },
      orderBy: {
        entryDate: 'desc',
      },
    });

    res.json({
      data: transactions,
    });
  } catch (error) {
    logger.error('Get partner transactions error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '取引履歴の取得中にエラーが発生しました',
      },
    });
  }
};

/**
 * @swagger
 * /api/v1/partners/{id}/balance:
 *   get:
 *     summary: Get partner balance
 *     description: Calculate and retrieve the current balance for a specific partner
 *     tags: [Partners]
 *     parameters:
 *       - $ref: '#/components/parameters/organizationId'
 *       - name: id
 *         in: path
 *         required: true
 *         description: Partner ID
 *         schema:
 *           type: string
 *       - name: asOfDate
 *         in: query
 *         description: Calculate balance as of this date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Partner balance information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     partnerId:
 *                       type: string
 *                     partnerName:
 *                       type: string
 *                     receivableBalance:
 *                       type: number
 *                       description: Amount receivable from partner (売掛金)
 *                     payableBalance:
 *                       type: number
 *                       description: Amount payable to partner (買掛金)
 *                     netBalance:
 *                       type: number
 *                       description: Net balance (receivable - payable)
 *                     asOfDate:
 *                       type: string
 *                       format: date
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export const getPartnerBalance = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { asOfDate } = req.query;
    const organizationId = req.user?.organizationId;

    // Check if partner exists
    const partner = await prisma.partner.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!partner) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: '取引先が見つかりません',
        },
      });
      return;
    }

    // Build query filters
    const where: Record<string, unknown> = {
      partnerId: id,
      organizationId,
    };

    if (asOfDate) {
      where.entryDate = { lte: new Date(asOfDate as string) };
    }

    // Get all transactions for this partner
    const transactions = await prisma.journalEntry.findMany({
      where,
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    // Calculate balances
    let receivableBalance = 0; // 売掛金
    let payableBalance = 0; // 買掛金

    for (const transaction of transactions) {
      for (const line of transaction.lines) {
        // Check if account is receivable (売掛金) or payable (買掛金)
        // Assuming accounts have codes like '1140' for receivables and '2110' for payables
        if (line.account.accountType === 'ASSET' && line.account.code.startsWith('114')) {
          // Receivables: Debit increases, Credit decreases
          receivableBalance += Number(line.debitAmount) - Number(line.creditAmount);
        } else if (
          line.account.accountType === 'LIABILITY' &&
          line.account.code.startsWith('211')
        ) {
          // Payables: Credit increases, Debit decreases
          payableBalance += Number(line.creditAmount) - Number(line.debitAmount);
        }
      }
    }

    const netBalance = receivableBalance - payableBalance;

    res.json({
      data: {
        partnerId: partner.id,
        partnerName: partner.name,
        receivableBalance,
        payableBalance,
        netBalance,
        asOfDate: asOfDate || new Date().toISOString().split('T')[0],
      },
    });
  } catch (error) {
    logger.error('Get partner balance error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '残高の取得中にエラーが発生しました',
      },
    });
  }
};
