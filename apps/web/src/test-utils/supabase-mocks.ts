/**
 * Common Supabase mock utilities for testing
 * Eliminates duplicate mock implementations across test files
 */

/**
 * Creates a chainable query mock for Supabase database operations
 * Used by multiple test files to simulate Supabase client behavior
 */
export const createSupabaseQueryMock = <T = unknown>(finalResult: T) => {
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnValue(Promise.resolve(finalResult)),
    single: jest.fn().mockResolvedValue(finalResult),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnValue(Promise.resolve(finalResult)),
    limit: jest.fn().mockReturnThis(),
    then: (resolve: (value: T) => unknown) => Promise.resolve(finalResult).then(resolve),
    catch: (reject: (reason?: unknown) => unknown) => Promise.resolve(finalResult).catch(reject),
    finally: (onFinally: () => void) => Promise.resolve(finalResult).finally(onFinally),
  };

  // Make chainable methods return the query object
  const chainableMethods = [
    'select',
    'eq',
    'neq',
    'or',
    'in',
    'gte',
    'lte',
    'lt',
    'gt',
    'ilike',
    'order',
    'insert',
    'update',
    'limit',
  ];

  chainableMethods.forEach((method) => {
    (query as Record<string, unknown>)[method] = jest.fn().mockReturnValue(query);
  });

  return query;
};

/**
 * Creates a mock Supabase client with common auth and database methods
 */
export const createMockSupabaseClient = () => {
  return {
    auth: {
      getUser: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
    },
    from: jest.fn(),
    rpc: jest.fn(),
  };
};

/**
 * Common mock user for testing
 */
export const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00.000Z',
};

/**
 * Common mock organization for testing
 */
export const mockOrganization = {
  id: 'org-123',
  name: 'Test Organization',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

/**
 * Helper to create a successful Supabase response
 */
export const createSuccessResponse = <T>(data: T) => ({
  data,
  error: null,
  count: null,
  status: 200,
  statusText: 'OK',
});

/**
 * Helper to create an error Supabase response
 */
export const createErrorResponse = (message: string, code?: string) => ({
  data: null,
  error: {
    message,
    code: code || 'UNKNOWN_ERROR',
    details: null,
    hint: null,
  },
  count: null,
  status: 400,
  statusText: 'Bad Request',
});
