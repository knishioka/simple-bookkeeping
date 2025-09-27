/**
 * Test to verify that test utilities are properly integrated
 */

import { TEST_CREDENTIALS, generateTestEmail, UserFactory, AccountFactory } from '../index';

describe('Test Utilities Integration', () => {
  it('should have test credentials defined', () => {
    expect(TEST_CREDENTIALS).toBeDefined();
    expect(TEST_CREDENTIALS.admin).toBeDefined();
    expect(TEST_CREDENTIALS.admin.email).toBe('admin.test@example.com');
  });

  it('should generate unique test emails', () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    expect(email1).not.toBe(email2);
    expect(email1).toMatch(/@example\.com$/);
  });

  it('should create test users with UserFactory', () => {
    const user = UserFactory.create();
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.role).toBeDefined();
  });

  it('should create test accounts with AccountFactory', () => {
    const account = AccountFactory.create();
    expect(account).toBeDefined();
    expect(account.id).toBeDefined();
    expect(account.code).toBeDefined();
    expect(account.type).toBeDefined();
  });
});
