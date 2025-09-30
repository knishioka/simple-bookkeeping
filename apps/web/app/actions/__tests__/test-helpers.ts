// Test helpers for Server Actions tests

interface MockQuery {
  select: jest.Mock;
  eq: jest.Mock;
  neq: jest.Mock;
  or: jest.Mock;
  in: jest.Mock;
  gte: jest.Mock;
  lte: jest.Mock;
  order: jest.Mock;
  range: jest.Mock;
  single: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
}

export function createMockSupabaseClient() {
  const mockQueries: MockQuery[] = [];
  let queryIndex = 0;

  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      verifyOtp: jest.fn(),
    },
    from: jest.fn((_table: string) => {
      if (queryIndex >= mockQueries.length) {
        // Return a default chainable mock if no more specific mocks
        const defaultQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          neq: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: new Error('Not mocked') }),
          insert: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          delete: jest.fn().mockReturnThis(),
        };
        return defaultQuery;
      }
      const query = mockQueries[queryIndex];
      queryIndex++;
      return query;
    }),
    resetQueryMocks: () => {
      queryIndex = 0;
      mockQueries.length = 0;
    },
    addQueryMock: (query: MockQuery) => {
      mockQueries.push(query);
    },
  };

  return mockSupabaseClient;
}

export function createChainableQuery(finalResult: { data: unknown; error: Error | null }) {
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnValue(Promise.resolve(finalResult)),
    single: jest.fn().mockResolvedValue(finalResult),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnValue(Promise.resolve(finalResult)),
  };

  // Make methods chainable by returning the query object
  Object.keys(query).forEach((key) => {
    if (key !== 'range' && key !== 'single' && key !== 'delete') {
      const originalFn = query[key as keyof typeof query];
      query[key as keyof typeof query] = jest.fn((...args) => {
        originalFn(...args);
        return query;
      });
    }
  });

  return query;
}

export function mockAuthUser(user: { id: string; email: string } | null = null) {
  return {
    data: { user },
    error: user ? null : new Error('Not authenticated'),
  };
}

export function mockQueryResult<T>(data: T | null, error: Error | null = null) {
  return {
    data,
    error,
    count: Array.isArray(data) ? data.length : data ? 1 : 0,
  };
}
