import { UserRole } from '@simple-bookkeeping/database';
import { Response } from 'express';

import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middlewares/auth';

export const getMyOrganizations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
        },
      });
    }

    const userOrganizations = await prisma.userOrganization.findMany({
      where: {
        userId,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            code: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        isDefault: 'desc',
      },
    });

    const organizations = userOrganizations
      .filter((uo) => uo.organization.isActive)
      .map((uo) => ({
        id: uo.organization.id,
        name: uo.organization.name,
        code: uo.organization.code,
        role: uo.role,
        isDefault: uo.isDefault,
      }));

    res.json({
      data: organizations,
    });
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '組織一覧の取得中にエラーが発生しました',
      },
    });
  }
};

export const getCurrentOrganization = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({
        error: {
          code: 'ORGANIZATION_REQUIRED',
          message: '組織が選択されていません',
        },
      });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: {
          select: {
            userOrganizations: true,
            accounts: true,
            journalEntries: true,
          },
        },
      },
    });

    if (!organization || !organization.isActive) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: '組織が見つかりません',
        },
      });
    }

    res.json({
      data: organization,
    });
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '組織情報の取得中にエラーが発生しました',
      },
    });
  }
};

export const createOrganization = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
        },
      });
    }

    const { name, code, taxId, address, phone, email } = req.body;

    // Check if organization code already exists
    const existingOrg = await prisma.organization.findUnique({
      where: { code },
    });

    if (existingOrg) {
      return res.status(400).json({
        error: {
          code: 'DUPLICATE_CODE',
          message: 'この組織コードは既に使用されています',
        },
      });
    }

    // Create organization and add user as admin
    const organization = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name,
          code,
          taxId,
          address,
          phone,
          email,
        },
      });

      // Add creating user as admin
      await tx.userOrganization.create({
        data: {
          userId,
          organizationId: org.id,
          role: UserRole.ADMIN,
          isDefault: true, // Make it default if it's their first organization
        },
      });

      return org;
    });

    res.status(201).json({
      data: organization,
    });
  } catch (error) {
    console.error('Create organization error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '組織の作成中にエラーが発生しました',
      },
    });
  }
};

export const updateOrganization = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    // Verify user is updating their current organization
    if (id !== organizationId) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'この組織を更新する権限がありません',
        },
      });
    }

    const { name, taxId, address, phone, email } = req.body;

    const organization = await prisma.organization.update({
      where: { id },
      data: {
        name,
        taxId,
        address,
        phone,
        email,
      },
    });

    res.json({
      data: organization,
    });
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '組織の更新中にエラーが発生しました',
      },
    });
  }
};

export const inviteUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { email, role } = req.body;
    const organizationId = req.user?.organizationId;

    // Verify user is inviting to their current organization
    if (id !== organizationId) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'この組織にユーザーを招待する権限がありません',
        },
      });
    }

    // Find user by email
    const invitedUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!invitedUser) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'ユーザーが見つかりません',
        },
      });
    }

    // Check if user is already in organization
    const existingMembership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: invitedUser.id,
          organizationId,
        },
      },
    });

    if (existingMembership) {
      return res.status(400).json({
        error: {
          code: 'ALREADY_MEMBER',
          message: 'このユーザーは既に組織のメンバーです',
        },
      });
    }

    // Add user to organization
    const userOrganization = await prisma.userOrganization.create({
      data: {
        userId: invitedUser.id,
        organizationId,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json({
      data: userOrganization,
    });
  } catch (error) {
    console.error('Invite user error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'ユーザーの招待中にエラーが発生しました',
      },
    });
  }
};

export const removeUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const organizationId = req.user?.organizationId;
    const currentUserId = req.user?.id;

    // Verify user is removing from their current organization
    if (id !== organizationId) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'この組織からユーザーを削除する権限がありません',
        },
      });
    }

    // Prevent self-removal
    if (targetUserId === currentUserId) {
      return res.status(400).json({
        error: {
          code: 'CANNOT_REMOVE_SELF',
          message: '自分自身を組織から削除することはできません',
        },
      });
    }

    // Check if user exists in organization
    const userOrganization = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId,
        },
      },
    });

    if (!userOrganization) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'ユーザーが組織に所属していません',
        },
      });
    }

    // Check if target user is the last admin
    if (userOrganization.role === UserRole.ADMIN) {
      const adminCount = await prisma.userOrganization.count({
        where: {
          organizationId,
          role: UserRole.ADMIN,
        },
      });

      if (adminCount <= 1) {
        return res.status(400).json({
          error: {
            code: 'LAST_ADMIN',
            message: '最後の管理者を削除することはできません',
          },
        });
      }
    }

    // Remove user from organization
    await prisma.userOrganization.delete({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId,
        },
      },
    });

    res.json({
      data: {
        message: 'ユーザーを組織から削除しました',
      },
    });
  } catch (error) {
    console.error('Remove user error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'ユーザーの削除中にエラーが発生しました',
      },
    });
  }
};

export const getOrganizationMembers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    // Verify user is getting members of their current organization
    if (id !== organizationId) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'この組織のメンバーを取得する権限がありません',
        },
      });
    }

    const members = await prisma.userOrganization.findMany({
      where: {
        organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // ADMIN first
        { user: { name: 'asc' } },
      ],
    });

    const membersData = members.map((member) => ({
      id: member.user.id,
      email: member.user.email,
      name: member.user.name,
      role: member.role,
      joinedAt: member.joinedAt,
    }));

    res.json({
      data: membersData,
    });
  } catch (error) {
    console.error('Get organization members error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'メンバー一覧の取得中にエラーが発生しました',
      },
    });
  }
};

export const updateUserRole = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const { role } = req.body;
    const organizationId = req.user?.organizationId;
    const currentUserId = req.user?.id;

    // Verify user is updating role in their current organization
    if (id !== organizationId) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'この組織のメンバーロールを更新する権限がありません',
        },
      });
    }

    // Prevent self role change
    if (targetUserId === currentUserId) {
      return res.status(400).json({
        error: {
          code: 'CANNOT_CHANGE_OWN_ROLE',
          message: '自分自身のロールを変更することはできません',
        },
      });
    }

    // Check if user exists in organization
    const userOrganization = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId,
        },
      },
    });

    if (!userOrganization) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'ユーザーが組織に所属していません',
        },
      });
    }

    // Check if changing from ADMIN and if it's the last admin
    if (userOrganization.role === UserRole.ADMIN && role !== UserRole.ADMIN) {
      const adminCount = await prisma.userOrganization.count({
        where: {
          organizationId,
          role: UserRole.ADMIN,
        },
      });

      if (adminCount <= 1) {
        return res.status(400).json({
          error: {
            code: 'LAST_ADMIN',
            message: '最後の管理者のロールを変更することはできません',
          },
        });
      }
    }

    // Update user role
    const updatedUserOrganization = await prisma.userOrganization.update({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId,
        },
      },
      data: {
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    res.json({
      data: {
        id: updatedUserOrganization.user.id,
        email: updatedUserOrganization.user.email,
        name: updatedUserOrganization.user.name,
        role: updatedUserOrganization.role,
      },
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'ロールの更新中にエラーが発生しました',
      },
    });
  }
};
