/**
 * Test utilities for Server Action hooks
 *
 * This file provides helper functions and mock data for testing
 * the useServerAction, useServerActionChain, and useServerActionForm hooks
 */

import type { ActionResult, ActionError } from '@/app/actions/types';

/**
 * Create a mock Server Action that resolves with the given result
 */
export function createMockAction<T>(result: ActionResult<T>) {
  return jest.fn<Promise<ActionResult<T>>, unknown[]>().mockResolvedValue(result);
}

/**
 * Create a mock Server Action that rejects with an error
 */
export function createMockActionThatThrows(error: Error) {
  return jest.fn().mockRejectedValue(error);
}

/**
 * Create a mock Server Action with delayed resolution for testing loading states
 */
export function createDelayedMockAction<T>(result: ActionResult<T>, delay: number = 100) {
  return jest
    .fn<Promise<ActionResult<T>>, unknown[]>()
    .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(result), delay)));
}

/**
 * Create a successful ActionResult
 */
export function createSuccessResult<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

/**
 * Create an error ActionResult
 */
export function createErrorResult(
  code: string,
  message: string,
  details?: unknown
): ActionResult<never> {
  return {
    success: false,
    error: { code, message, details },
  };
}

/**
 * Mock ActionError objects for testing
 */
export const mockErrors = {
  validation: {
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
  } as ActionError,
  unauthorized: {
    code: 'UNAUTHORIZED',
    message: 'Unauthorized access',
  } as ActionError,
  notFound: {
    code: 'NOT_FOUND',
    message: 'Resource not found',
  } as ActionError,
  internal: {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
  } as ActionError,
  network: {
    code: 'NETWORK_ERROR',
    message: 'Network request failed',
  } as ActionError,
  timeout: {
    code: 'TIMEOUT',
    message: 'Request timed out',
  } as ActionError,
  rateLimit: {
    code: 'LIMIT_EXCEEDED',
    message: 'Rate limit exceeded',
    details: { retryAfter: 60 },
  } as ActionError,
};

/**
 * Mock successful data responses for testing
 */
export const mockData = {
  user: {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
  },
  account: {
    id: 'acc-123',
    code: '1110',
    name: '現金',
    type: 'asset',
  },
  accounts: [
    { id: 'acc-1', code: '1110', name: '現金', type: 'asset' },
    { id: 'acc-2', code: '2110', name: '買掛金', type: 'liability' },
  ],
  journalEntry: {
    id: 'je-123',
    date: '2024-01-01',
    amount: 10000,
    description: 'Test entry',
  },
};

/**
 * Wait for async operations to complete
 * Useful for testing loading states
 */
export function waitForAsync(ms: number = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock form event for testing form submissions
 */
export function createMockFormEvent(
  formData: Record<string, string> = {}
): React.FormEvent<HTMLFormElement> {
  const form = document.createElement('form');

  // Add form data as hidden inputs
  Object.entries(formData).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  const event = {
    preventDefault: jest.fn(),
    currentTarget: form,
    target: form,
  } as unknown as React.FormEvent<HTMLFormElement>;

  return event;
}

/**
 * Create a mock Server Action that tracks call arguments
 */
export function createTrackableAction<T>(result: ActionResult<T>) {
  const action = createMockAction(result);
  const calls: unknown[][] = [];

  action.mockImplementation(async (...args) => {
    calls.push(args);
    return result;
  });

  return {
    action,
    calls,
    getLastCall: () => calls[calls.length - 1],
    getCallCount: () => calls.length,
    reset: () => {
      calls.length = 0;
      action.mockClear();
    },
  };
}

/**
 * Create a mock Server Action that can be controlled manually
 */
export function createControllableAction<T>() {
  let resolvePromise: ((value: ActionResult<T>) => void) | null = null;
  let rejectPromise: ((error: Error) => void) | null = null;

  const action = jest.fn<Promise<ActionResult<T>>, unknown[]>().mockImplementation(
    () =>
      new Promise((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
      })
  );

  return {
    action,
    resolve: (result: ActionResult<T>) => resolvePromise?.(result),
    reject: (error: Error) => rejectPromise?.(error),
    reset: () => {
      action.mockClear();
      resolvePromise = null;
      rejectPromise = null;
    },
  };
}

/**
 * Mock toast functions for testing toast notifications
 */
export const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  loading: jest.fn(),
  dismiss: jest.fn(),
  reset: () => {
    mockToast.success.mockClear();
    mockToast.error.mockClear();
    mockToast.loading.mockClear();
    mockToast.dismiss.mockClear();
  },
};

/**
 * Setup mock for react-hot-toast
 */
export function setupToastMock() {
  jest.mock('react-hot-toast', () => mockToast);
}

/**
 * Create a sequence of mock actions for testing chains
 */
export function createActionSequence(
  results: ActionResult<unknown>[]
): Array<(...args: unknown[]) => Promise<ActionResult<unknown>>> {
  return results.map((result, index) => {
    return jest.fn().mockImplementation((...args) => {
      // For chain actions, the previous results are passed as arguments
      // Verify that previous results match expected pattern
      if (index > 0 && args.length !== index) {
        throw new Error(`Chain action ${index} expected ${index} arguments, got ${args.length}`);
      }
      return Promise.resolve(result);
    });
  });
}

/**
 * Assert that an action was called with specific arguments
 */
export function expectActionCalledWith(
  action: jest.Mock,
  expectedArgs: unknown[],
  callIndex: number = 0
) {
  expect(action).toHaveBeenCalled();
  const actualCall = action.mock.calls[callIndex];

  // Filter out the options object if it's the last argument
  const actualArgs = actualCall.filter((arg: unknown, index: number) => {
    if (index === actualCall.length - 1) {
      return !(
        typeof arg === 'object' &&
        arg !== null &&
        ('successMessage' in arg ||
          'errorMessage' in arg ||
          'onSuccess' in arg ||
          'onError' in arg ||
          'showToast' in arg)
      );
    }
    return true;
  });

  expect(actualArgs).toEqual(expectedArgs);
}

/**
 * Extract options from action call
 */
export function extractOptionsFromCall(action: jest.Mock, callIndex: number = 0) {
  const call = action.mock.calls[callIndex];
  if (!call) return null;

  const lastArg = call[call.length - 1];
  if (
    typeof lastArg === 'object' &&
    lastArg !== null &&
    ('successMessage' in lastArg ||
      'errorMessage' in lastArg ||
      'onSuccess' in lastArg ||
      'onError' in lastArg ||
      'showToast' in lastArg)
  ) {
    return lastArg;
  }

  return null;
}

/**
 * Test helper to verify error handling behavior
 */
export async function expectErrorHandling(fn: () => Promise<unknown>, expectedError: ActionError) {
  await expect(fn()).rejects.toThrow(expectedError.message);
}

/**
 * Create multiple mock actions with different results for testing concurrent execution
 */
export function createConcurrentActions<T>(
  count: number,
  resultFactory: (index: number) => ActionResult<T>
) {
  return Array.from({ length: count }, (_, i) => createMockAction(resultFactory(i)));
}

/**
 * Create a mock action chain for testing
 */
export function createActionChain(...results: ActionResult<unknown>[]): jest.Mock[] {
  return results.map((result) =>
    jest.fn<Promise<ActionResult<unknown>>, unknown[]>().mockResolvedValue(result)
  );
}
