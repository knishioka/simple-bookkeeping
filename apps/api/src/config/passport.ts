import { UserRole } from '@simple-bookkeeping/database';
import { ExtractJwt, Strategy as JwtStrategy, StrategyOptions } from 'passport-jwt';

import { prisma } from '../lib/prisma';

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required');
}

const opts: StrategyOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: jwtSecret,
};

export const jwtStrategy = new JwtStrategy(opts, async (payload, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        userOrganizations: {
          select: {
            organizationId: true,
            role: true,
            isDefault: true,
            organization: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return done(null, false);
    }

    // Get the role from JWT payload (organization-based)
    const organizationId = payload.organizationId;
    const role = payload.role as UserRole;

    // Verify user still has access to the organization
    let currentOrgRole = role;
    if (organizationId) {
      const userOrg = user.userOrganizations.find((uo) => uo.organizationId === organizationId);

      if (!userOrg || !userOrg.organization.isActive) {
        // User no longer has access to this organization
        return done(null, false);
      }

      // Use the current role from database (in case it was updated)
      currentOrgRole = userOrg.role;
    }

    // Map user with organization-based role
    const mappedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: currentOrgRole,
      organizationId,
      userOrganizations: user.userOrganizations,
    };

    return done(null, mappedUser);
  } catch (error) {
    return done(error, false);
  }
});
