/**
 * Tests for useServerAction hook
 *
 * This test suite covers the original useServerAction API where:
 * - Hook constructor only takes the action function
 * - Options are passed as the last argument to execute()
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';

import { useServerAction } from '../useServerAction';

import {
  createMockAction,
  createMockActionThatThrows,
  createDelayedMockAction,
  createSuccessResult,
  createErrorResult,
  mockErrors,
  mockData,
} from './test-utilities';

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn(),
  },
}));

describe('useServerAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should initialize with default state', () => {
      const mockAction = createMockAction(createSuccessResult(mockData.user));
      const { result } = renderHook(() => useServerAction(mockAction));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isPending).toBe(false);
      expect(typeof result.current.execute).toBe('function');
      expect(typeof result.current.executeWithTransition).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });

    it('should execute action and update loading state', async () => {
      const mockAction = createDelayedMockAction(createSuccessResult(mockData.user), 50);
      const { result } = renderHook(() => useServerAction(mockAction));

      let executePromise: Promise<any>;
      act(() => {
        executePromise = result.current.execute('arg1', 'arg2');
      });

      // Check loading state immediately after execution
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();

      await act(async () => {
        await executePromise;
      });

      // Check state after completion
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toEqual(mockData.user);
      expect(result.current.error).toBeNull();
    });

    it('should handle successful action execution', async () => {
      const mockAction = createMockAction(createSuccessResult(mockData.account));
      const { result } = renderHook(() => useServerAction(mockAction));

      await act(async () => {
        await result.current.execute('org-123');
      });

      expect(mockAction).toHaveBeenCalledWith('org-123');
      expect(result.current.data).toEqual(mockData.account);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle action error response', async () => {
      const mockAction = createMockAction(
        createErrorResult(mockErrors.validation.code, mockErrors.validation.message)
      );
      const { result } = renderHook(() => useServerAction(mockAction));

      await act(async () => {
        try {
          await result.current.execute();
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual(mockErrors.validation);
      expect(result.current.isLoading).toBe(false);
      expect(toast.error).toHaveBeenCalledWith(mockErrors.validation.message);
    });

    it('should handle action throwing an error', async () => {
      const thrownError = new Error('Network failed');
      const mockAction = createMockActionThatThrows(thrownError);
      const { result } = renderHook(() => useServerAction(mockAction));

      await act(async () => {
        try {
          await result.current.execute();
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'Network failed',
      });
      expect(result.current.isLoading).toBe(false);
      expect(toast.error).toHaveBeenCalledWith('Network failed');
    });

    it('should reset state when reset is called', async () => {
      const mockAction = createMockAction(createSuccessResult(mockData.user));
      const { result } = renderHook(() => useServerAction(mockAction));

      // Execute action first
      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.data).toEqual(mockData.user);

      // Reset state
      act(() => {
        result.current.reset();
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isPending).toBe(false);
    });
  });

  describe('Options passed to execute()', () => {
    it('should show success toast with custom message', async () => {
      const mockAction = createMockAction(createSuccessResult(mockData.user));
      const { result } = renderHook(() => useServerAction(mockAction));

      await act(async () => {
        await result.current.execute('arg1', {
          successMessage: 'User loaded successfully!',
        });
      });

      expect(toast.success).toHaveBeenCalledWith('User loaded successfully!');
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should show error toast with custom message', async () => {
      const mockAction = createMockAction(createErrorResult('ERROR', 'Default error'));
      const { result } = renderHook(() => useServerAction(mockAction));

      await act(async () => {
        try {
          await result.current.execute({
            errorMessage: 'Custom error message',
          });
        } catch {
          // Expected to throw
        }
      });

      expect(toast.error).toHaveBeenCalledWith('Custom error message');
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('should not show toast when showToast is false', async () => {
      const mockAction = createMockAction(createSuccessResult(mockData.user));
      const { result } = renderHook(() => useServerAction(mockAction));

      await act(async () => {
        await result.current.execute({
          successMessage: 'Should not show',
          showToast: false,
        });
      });

      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should call onSuccess callback on successful execution', async () => {
      const mockAction = createMockAction(createSuccessResult(mockData.account));
      const onSuccess = jest.fn();
      const { result } = renderHook(() => useServerAction(mockAction));

      await act(async () => {
        await result.current.execute('org-123', {
          onSuccess,
        });
      });

      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it('should call onError callback on error', async () => {
      const mockAction = createMockAction(
        createErrorResult(mockErrors.notFound.code, mockErrors.notFound.message)
      );
      const onError = jest.fn();
      const { result } = renderHook(() => useServerAction(mockAction));

      await act(async () => {
        try {
          await result.current.execute({
            onError,
          });
        } catch {
          // Expected to throw
        }
      });

      expect(onError).toHaveBeenCalledWith(mockErrors.notFound);
    });

    it('should correctly pass arguments to action', async () => {
      const mockAction = createMockAction(createSuccessResult(mockData.accounts));
      const { result } = renderHook(() => useServerAction(mockAction));

      await act(async () => {
        await result.current.execute(
          'org-123',
          { page: 1, pageSize: 20 },
          {
            successMessage: 'Success!',
          }
        );
      });

      // The action should be called with all arguments except the options
      expect(mockAction).toHaveBeenCalledWith('org-123', { page: 1, pageSize: 20 });
    });

    it('should distinguish between data object and options object', async () => {
      const mockAction = createMockAction(createSuccessResult({ id: 'created' }));
      const { result } = renderHook(() => useServerAction(mockAction));

      // Pass a data object that has string properties that happen to match option names
      // But since the values are not the right types, it shouldn't be treated as options
      const dataObject = {
        name: 'Test',
        description: 'This is not options',
        successMessage: 123, // Wrong type - should be string
        onSuccess: 'not a function', // Wrong type - should be function
      };

      await act(async () => {
        await result.current.execute(dataObject);
      });

      // The data object should be passed as argument, not treated as options
      expect(mockAction).toHaveBeenCalledWith(dataObject);
      expect(toast.success).not.toHaveBeenCalled(); // No success message provided
    });

    it('should handle no arguments', async () => {
      const mockAction = createMockAction(createSuccessResult(mockData.accounts));
      const { result } = renderHook(() => useServerAction(mockAction));

      await act(async () => {
        await result.current.execute();
      });

      expect(mockAction).toHaveBeenCalledWith();
    });
  });

  describe('Transition Support', () => {
    it('should execute with transition', async () => {
      const mockAction = createMockAction(createSuccessResult(mockData.user));
      const { result } = renderHook(() => useServerAction(mockAction));

      act(() => {
        result.current.executeWithTransition('arg1');
      });

      // isPending should be true initially
      expect(result.current.isPending).toBe(true);

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(mockAction).toHaveBeenCalledWith('arg1');
      expect(result.current.data).toEqual(mockData.user);
    });

    it('should handle transition with options', async () => {
      const mockAction = createMockAction(createSuccessResult(mockData.account));
      const onSuccess = jest.fn();
      const { result } = renderHook(() => useServerAction(mockAction));

      act(() => {
        result.current.executeWithTransition('org-123', {
          successMessage: 'Loaded with transition!',
          onSuccess,
        });
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(toast.success).toHaveBeenCalledWith('Loaded with transition!');
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network request failed');
      networkError.name = 'NetworkError';
      const mockAction = createMockActionThatThrows(networkError);
      const { result } = renderHook(() => useServerAction(mockAction));

      await act(async () => {
        try {
          await result.current.execute();
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'Network request failed',
      });
      expect(toast.error).toHaveBeenCalledWith('Network request failed');
    });

    it('should clear error on successful retry', async () => {
      let callCount = 0;
      const mockAction = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(createErrorResult('ERROR', 'First call failed'));
        }
        return Promise.resolve(createSuccessResult(mockData.user));
      });

      const { result } = renderHook(() => useServerAction(mockAction));

      // First call - should fail
      await act(async () => {
        try {
          await result.current.execute();
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toEqual({
        code: 'ERROR',
        message: 'First call failed',
      });

      // Second call - should succeed
      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.data).toEqual(mockData.user);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Return Value', () => {
    it('should return data from execute on success', async () => {
      const mockAction = createMockAction(createSuccessResult(mockData.account));
      const { result } = renderHook(() => useServerAction(mockAction));

      let returnedData: any;
      await act(async () => {
        returnedData = await result.current.execute();
      });

      expect(returnedData).toEqual(mockData.account);
    });

    it('should throw error from execute on failure', async () => {
      const mockAction = createMockAction(createErrorResult('ERROR', 'Operation failed'));
      const { result } = renderHook(() => useServerAction(mockAction));

      let thrownError: any;
      await act(async () => {
        try {
          await result.current.execute();
        } catch (error) {
          thrownError = error;
        }
      });

      expect(thrownError).toBeDefined();
      expect(thrownError.message).toBe('Operation failed');
    });
  });
});
