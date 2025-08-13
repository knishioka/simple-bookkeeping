import { faker } from '@faker-js/faker';
import { User, UserRole } from '@simple-bookkeeping/types';

import { generateSecurePassword } from '../test-config';

/**
 * Factory for creating test user data
 */
export class UserFactory {
  /**
   * Create a test user with optional overrides
   * @param overrides - Optional properties to override
   * @returns User object
   */
  static create(overrides?: Partial<User>): User {
    const now = new Date();

    return {
      id: faker.string.uuid(),
      email: faker.internet.email({
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        provider: 'test.localhost',
      }),
      name: faker.person.fullName(),
      role: UserRole.VIEWER,
      organizationId: faker.string.uuid(),
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  /**
   * Create multiple test users
   * @param count - Number of users to create
   * @param overrides - Optional properties to override for all users
   * @returns Array of User objects
   */
  static createMany(count: number, overrides?: Partial<User>): User[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  /**
   * Create an admin user
   * @param overrides - Optional properties to override
   * @returns Admin User object
   */
  static createAdmin(overrides?: Partial<User>): User {
    return this.create({
      role: UserRole.ADMIN,
      email: faker.internet.email({
        firstName: 'admin',
        provider: 'test.localhost',
      }),
      name: `Admin ${faker.person.lastName()}`,
      ...overrides,
    });
  }

  /**
   * Create an accountant user
   * @param overrides - Optional properties to override
   * @returns Accountant User object
   */
  static createAccountant(overrides?: Partial<User>): User {
    return this.create({
      role: UserRole.ACCOUNTANT,
      email: faker.internet.email({
        firstName: 'accountant',
        provider: 'test.localhost',
      }),
      name: `Accountant ${faker.person.lastName()}`,
      ...overrides,
    });
  }

  /**
   * Create a viewer user
   * @param overrides - Optional properties to override
   * @returns Viewer User object
   */
  static createViewer(overrides?: Partial<User>): User {
    return this.create({
      role: UserRole.VIEWER,
      email: faker.internet.email({
        firstName: 'viewer',
        provider: 'test.localhost',
      }),
      name: `Viewer ${faker.person.lastName()}`,
      ...overrides,
    });
  }

  /**
   * Create an inactive user
   * @param overrides - Optional properties to override
   * @returns Inactive User object
   */
  static createInactive(overrides?: Partial<User>): User {
    return this.create({
      ...overrides,
    });
  }

  /**
   * Generate a test password
   * @returns Test password string
   */
  private static generateTestPassword(): string {
    return generateSecurePassword('Test');
  }

  /**
   * Create user creation DTO (without id and timestamps)
   * @param overrides - Optional properties to override
   * @returns User creation DTO
   */
  static createDTO(overrides?: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>) {
    const user = this.create(overrides as Partial<User>);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, createdAt, updatedAt, ...dto } = user;
    return dto;
  }

  /**
   * Create login credentials
   * @param role - User role
   * @returns Email and password for login
   */
  static createLoginCredentials(role: UserRole = UserRole.VIEWER) {
    const email = faker.internet.email({
      firstName: role,
      provider: 'test.localhost',
    });
    const password = this.generateTestPassword();

    return { email, password };
  }
}
