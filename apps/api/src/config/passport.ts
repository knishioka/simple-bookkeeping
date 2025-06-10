import { prisma, UserRole } from '@simple-bookkeeping/database';
import { ExtractJwt, Strategy as JwtStrategy, StrategyOptions } from 'passport-jwt';

const opts: StrategyOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
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

    // Map user with system-wide role (ADMIN by default for now)
    const mappedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: UserRole.ADMIN, // Will be removed once we fully migrate to org-based roles
      userOrganizations: user.userOrganizations,
    };

    return done(null, mappedUser);
  } catch (error) {
    return done(error, false);
  }
});
