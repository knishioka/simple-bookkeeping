// Credentials management
export {
  TEST_CREDENTIALS,
  TEST_JWT_CONFIG,
  TEST_DATABASE_CONFIG,
  TEST_API_CONFIG,
  generateTestEmail,
  generateTestCredentials,
  generateSecurePassword,
  isTestEnvironment,
  validateTestCredentials,
} from './credentials';

// Auth helpers
export {
  generateTestJWT,
  generateTestRefreshToken,
  generateExpiredTestJWT,
  getTestCredentialsByRole,
  createTestAuthHeader,
  mockAuthUser,
  generateTestSession,
} from './helpers/auth.helpers';

// E2E helpers
export {
  loginAsAdmin,
  loginAsAccountant,
  loginAsViewer,
  loginWithCredentials,
  logout,
  getE2ECredentials,
  setupTestSession,
  waitForAPI,
} from './helpers/e2e.helpers';

// Factories
export { UserFactory } from './factories/user.factory';
export { AccountFactory } from './factories/account.factory';
