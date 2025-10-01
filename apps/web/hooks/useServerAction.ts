'use client';

import type { ActionResult, ActionError } from '@/app/actions/types';

import { useState, useCallback, useTransition } from 'react';
import { toast } from 'react-hot-toast';

/**
 * Server Action 実行状態
 */
export interface ServerActionState<T> {
  /** データ */
  data: T | null;
  /** エラー情報 */
  error: ActionError | null;
  /** 実行中フラグ */
  isLoading: boolean;
  /** トランジション中フラグ（React 18 Suspense用） */
  isPending: boolean;
}

/**
 * Server Action 実行オプション
 */
export interface ServerActionOptions {
  /** 成功時のメッセージ */
  successMessage?: string;
  /** エラー時のメッセージ（デフォルトはerror.message） */
  errorMessage?: string;
  /** 成功時のコールバック */
  onSuccess?: () => void;
  /** エラー時のコールバック */
  onError?: (error: ActionError) => void;
  /** トースト通知を表示するか（デフォルト: true） */
  showToast?: boolean;
}

/**
 * Server Actions を実行するためのカスタムフック
 *
 * @template TData - Server Action の戻り値の型
 * @template TArgs - Server Action の引数の型
 *
 * @example
 * ```tsx
 * const { execute, data, error, isLoading } = useServerAction(getAccounts);
 *
 * // 実行
 * await execute('org-id', { page: 1 });
 *
 * // オプション付き実行
 * await execute('org-id', undefined, {
 *   successMessage: '勘定科目を取得しました',
 *   onSuccess: () => console.log('Success!')
 * });
 * ```
 */
export function useServerAction<TData, TArgs extends unknown[] = []>(
  action: (...args: TArgs) => Promise<ActionResult<TData>>
) {
  const [state, setState] = useState<ServerActionState<TData>>({
    data: null,
    error: null,
    isLoading: false,
    isPending: false,
  });

  const [isPending, startTransition] = useTransition();

  const execute = useCallback(
    async (...args: [...TArgs, ServerActionOptions?]) => {
      // 最後の引数がオプションかどうかチェック
      let options: ServerActionOptions = { showToast: true };
      let actionArgs: TArgs;

      const lastArg = args[args.length - 1];
      const isOptionsObject =
        lastArg &&
        typeof lastArg === 'object' &&
        !Array.isArray(lastArg) &&
        ('successMessage' in lastArg ||
          'errorMessage' in lastArg ||
          'onSuccess' in lastArg ||
          'onError' in lastArg ||
          'showToast' in lastArg);

      if (isOptionsObject) {
        options = { ...options, ...lastArg };
        actionArgs = args.slice(0, -1) as unknown as TArgs;
      } else {
        actionArgs = args as unknown as TArgs;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const result = await action(...actionArgs);

        if (result.success) {
          setState({
            data: result.data,
            error: null,
            isLoading: false,
            isPending: false,
          });

          if (options.showToast && options.successMessage) {
            toast.success(options.successMessage);
          }

          options.onSuccess?.();
          return result.data;
        } else {
          setState({
            data: null,
            error: result.error,
            isLoading: false,
            isPending: false,
          });

          if (options.showToast) {
            toast.error(options.errorMessage || result.error.message);
          }

          options.onError?.(result.error);
          throw new Error(result.error.message);
        }
      } catch (error) {
        // Server Action 自体がエラーをスローした場合
        const errorObj: ActionError = {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'エラーが発生しました',
        };

        setState({
          data: null,
          error: errorObj,
          isLoading: false,
          isPending: false,
        });

        if (options.showToast) {
          toast.error(options.errorMessage || errorObj.message);
        }

        options.onError?.(errorObj);
        throw error;
      }
    },
    [action]
  );

  const executeWithTransition = useCallback(
    (...args: [...TArgs, ServerActionOptions?]) => {
      startTransition(() => {
        setState((prev) => ({ ...prev, isPending: true }));
        execute(...args).finally(() => {
          setState((prev) => ({ ...prev, isPending: false }));
        });
      });
    },
    [execute]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isLoading: false,
      isPending: false,
    });
  }, []);

  return {
    ...state,
    isPending: state.isPending || isPending,
    execute,
    executeWithTransition,
    reset,
  };
}

/**
 * 複数の Server Actions を順次実行するためのフック
 *
 * @example
 * ```tsx
 * const chain = useServerActionChain();
 *
 * const handleSubmit = async () => {
 *   await chain.execute([
 *     () => createAccount(accountData),
 *     (accountResult) => createJournalEntry({ accountId: accountResult.id }),
 *   ]);
 * };
 * ```
 */
export function useServerActionChain() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ActionError | null>(null);

  const execute = useCallback(
    async <T extends unknown[]>(
      actions: Array<(...args: unknown[]) => Promise<ActionResult<unknown>>>,
      options?: ServerActionOptions
    ): Promise<T> => {
      setIsLoading(true);
      setError(null);

      const results: unknown[] = [];

      try {
        for (const action of actions) {
          const result = await action(...results);

          if (!result.success) {
            throw new Error(result.error.message);
          }

          results.push(result.data);
        }

        if (options?.showToast !== false && options?.successMessage) {
          toast.success(options.successMessage);
        }

        options?.onSuccess?.();
        return results as T;
      } catch (err) {
        const errorObj: ActionError = {
          code: 'CHAIN_ERROR',
          message: err instanceof Error ? err.message : 'チェーン実行中にエラーが発生しました',
        };

        setError(errorObj);

        if (options?.showToast !== false) {
          toast.error(options?.errorMessage || errorObj.message);
        }

        options?.onError?.(errorObj);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    execute,
    isLoading,
    error,
  };
}

/**
 * フォーム送信用の Server Action フック
 *
 * @example
 * ```tsx
 * const { handleSubmit, isSubmitting } = useServerActionForm(
 *   createAccount,
 *   {
 *     successMessage: '勘定科目を作成しました',
 *     onSuccess: () => router.push('/accounts')
 *   }
 * );
 *
 * <form onSubmit={handleSubmit}>
 *   ...
 * </form>
 * ```
 */
export function useServerActionForm<TData, TArgs extends unknown[] = []>(
  action: (...args: TArgs) => Promise<ActionResult<TData>>,
  options?: ServerActionOptions
) {
  const { execute, isLoading, error, data } = useServerAction(action);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);

      // FormData を適切な引数に変換（実装はアクションに応じて調整）
      const args = [formData] as TArgs;

      return execute(...args, options);
    },
    [execute, options]
  );

  return {
    handleSubmit,
    isSubmitting: isLoading,
    error,
    data,
  };
}
