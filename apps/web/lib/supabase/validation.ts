/**
 * Supabase API key validation utilities
 *
 * Ensures API keys are in the new format (not legacy sbp_* format)
 * which is required for proper authentication flow.
 */

/**
 * Validates that a Supabase API key is not in legacy format
 *
 * @param key - The API key to validate
 * @param envName - The environment variable name for error messaging
 * @throws Error if the key is in legacy format (starts with 'sbp_')
 */
export function assertNotLegacyKey(key: string, envName: string): void {
  // Skip validation in test environment
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  if (key.startsWith('sbp_')) {
    throw new Error(
      `${envName} にレガシー形式 (sbp_...) の Supabase API キーが設定されています。` +
        `Project settings → API で新しいキーを発行し、環境変数を更新してください。`
    );
  }
}
