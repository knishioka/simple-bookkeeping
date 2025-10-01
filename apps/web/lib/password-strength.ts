/**
 * Password strength validation utilities
 * OWASP 2025 compliant password requirements
 */

import zxcvbn from 'zxcvbn';

/**
 * Password requirements based on OWASP 2025 guidelines
 */
export const PASSWORD_REQUIREMENTS = {
  MIN_LENGTH: 12,
  MAX_LENGTH: 128,
  MIN_STRENGTH_SCORE: 3, // zxcvbn score (0-4, where 3 is "good")
} as const;

/**
 * Common weak passwords list (top 100)
 * In production, this should be expanded to top 10,000
 */
const COMMON_WEAK_PASSWORDS = new Set([
  'password',
  'Password',
  'password123',
  'Password123',
  'password1',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty',
  'qwertyuiop',
  'admin',
  'administrator',
  'letmein',
  'welcome',
  'monkey',
  'dragon',
  'master',
  'superman',
  'batman',
  'trustno1',
  'iloveyou',
  'sunshine',
  'princess',
  'starwars',
  'whatever',
  'shadow',
  'cheese',
  'computer',
  'chocolate',
  'football',
  'soccer',
  'baseball',
  'basketball',
  'password!',
  'P@ssw0rd',
  'P@ssword',
  'passw0rd',
  'Passw0rd!',
  'qwerty123',
  'abc123',
]);

/**
 * Password strength levels
 */
export enum PasswordStrength {
  VERY_WEAK = 0,
  WEAK = 1,
  FAIR = 2,
  GOOD = 3,
  STRONG = 4,
}

/**
 * Password strength result interface
 */
export interface PasswordStrengthResult {
  score: PasswordStrength;
  feedback: {
    warning: string;
    suggestions: string[];
  };
  crackTime: {
    display: string;
    seconds: number;
  };
  isValid: boolean;
  errors: string[];
}

/**
 * Validate password strength using zxcvbn and OWASP guidelines
 *
 * @param password - The password to validate
 * @param userInputs - Optional user-specific data to check against (email, name, etc.)
 * @returns Password strength analysis result
 */
export function validatePasswordStrength(
  password: string,
  userInputs: string[] = []
): PasswordStrengthResult {
  const errors: string[] = [];

  // Length validation
  if (password.length < PASSWORD_REQUIREMENTS.MIN_LENGTH) {
    errors.push(`パスワードは最低${PASSWORD_REQUIREMENTS.MIN_LENGTH}文字以上必要です`);
  }

  if (password.length > PASSWORD_REQUIREMENTS.MAX_LENGTH) {
    errors.push(`パスワードは最大${PASSWORD_REQUIREMENTS.MAX_LENGTH}文字以下にしてください`);
  }

  // Check for common weak passwords
  if (COMMON_WEAK_PASSWORDS.has(password)) {
    errors.push('このパスワードは一般的すぎて安全ではありません');
  }

  // Check for spaces (optional - can be removed if spaces are allowed)
  if (password.includes(' ')) {
    errors.push('パスワードにスペースを含めることはできません');
  }

  // Use zxcvbn for advanced strength checking
  const result = zxcvbn(password, userInputs);

  // Translate feedback to Japanese
  const translatedFeedback = translateFeedback(result.feedback);

  const crackTimeDisplay = String(result.crack_times_display.offline_slow_hashing_1e4_per_second);
  const crackTimeSeconds = Number(result.crack_times_seconds.offline_slow_hashing_1e4_per_second);

  return {
    score: result.score as PasswordStrength,
    feedback: translatedFeedback,
    crackTime: {
      display: translateCrackTime(crackTimeDisplay),
      seconds: crackTimeSeconds,
    },
    isValid: errors.length === 0 && result.score >= PASSWORD_REQUIREMENTS.MIN_STRENGTH_SCORE,
    errors,
  };
}

/**
 * zxcvbn feedback type
 */
interface ZxcvbnFeedback {
  warning?: string;
  suggestions?: string[];
}

/**
 * Translate zxcvbn feedback to Japanese
 */
function translateFeedback(feedback: ZxcvbnFeedback): { warning: string; suggestions: string[] } {
  const warningMap: Record<string, string> = {
    'This is a top-10 common password': 'これは最も一般的なパスワードの1つです',
    'This is a top-100 common password': 'これは非常に一般的なパスワードです',
    'This is a very common password': 'これは非常に一般的なパスワードです',
    'This is similar to a commonly used password': 'これは一般的なパスワードと似ています',
    'A word by itself is easy to guess': '単語1つだけでは推測されやすいです',
    'Names and surnames by themselves are easy to guess': '名前や姓だけでは推測されやすいです',
    'Common names and surnames are easy to guess': '一般的な名前は推測されやすいです',
    'Straight rows of keys are easy to guess': 'キーボードの並び順は推測されやすいです',
    'Short keyboard patterns are easy to guess': '短いキーボードパターンは推測されやすいです',
    'Repeats like "aaa" are easy to guess': '「aaa」のような繰り返しは推測されやすいです',
    'Repeats like "abcabcabc" are only slightly harder to guess than "abc"':
      '「abcabcabc」のような繰り返しは「abc」とほぼ同じくらい推測されやすいです',
    'Sequences like abc or 6543 are easy to guess':
      '「abc」や「6543」のような連続は推測されやすいです',
    'Recent years are easy to guess': '最近の年は推測されやすいです',
    'Dates are often easy to guess': '日付は推測されやすいです',
  };

  const suggestionMap: Record<string, string> = {
    'Add another word or two. Uncommon words are better.':
      'さらに1〜2つの単語を追加してください。一般的でない単語が良いです。',
    'Use a few words, avoid common phrases':
      'いくつかの単語を使用し、一般的なフレーズは避けてください',
    'No need for symbols, digits, or uppercase letters': '記号、数字、大文字は必須ではありません',
    'Use a longer keyboard pattern with more turns':
      'より長く、複雑なキーボードパターンを使用してください',
    'Avoid repeated words and characters': '繰り返しの単語や文字は避けてください',
    'Avoid sequences': '連続する文字は避けてください',
    'Avoid recent years': '最近の年は避けてください',
    'Avoid years that are associated with you': '自分に関連する年は避けてください',
    'Avoid dates and years that are associated with you': '自分に関連する日付や年は避けてください',
    "Capitalization doesn't help very much": '大文字化はそれほど効果的ではありません',
    'All-uppercase is almost as easy to guess as all-lowercase':
      'すべて大文字はすべて小文字とほぼ同じくらい推測されやすいです',
    "Reversed words aren't much harder to guess": '逆さまの単語もそれほど推測が困難ではありません',
    "Predictable substitutions like '@' instead of 'a' don't help very much":
      '「@」を「a」の代わりに使うような予測可能な置換は効果的ではありません',
  };

  return {
    warning: feedback.warning ? warningMap[feedback.warning] || feedback.warning : '',
    suggestions: (feedback.suggestions || []).map((s: string) => suggestionMap[s] || s),
  };
}

/**
 * Translate crack time display to Japanese
 */
function translateCrackTime(display: string): string {
  const timeMap: Record<string, string> = {
    'less than a second': '1秒未満',
    instant: '即座',
    seconds: '数秒',
    minutes: '数分',
    hours: '数時間',
    days: '数日',
    months: '数ヶ月',
    years: '数年',
    centuries: '数世紀',
  };

  // Check for exact matches first
  if (timeMap[display]) {
    return timeMap[display];
  }

  // Handle patterns like "1 hour", "2 days", etc.
  const patterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/^(\d+) seconds?$/, (m) => `${m[1]}秒`],
    [/^(\d+) minutes?$/, (m) => `${m[1]}分`],
    [/^(\d+) hours?$/, (m) => `${m[1]}時間`],
    [/^(\d+) days?$/, (m) => `${m[1]}日`],
    [/^(\d+) months?$/, (m) => `${m[1]}ヶ月`],
    [/^(\d+) years?$/, (m) => `${m[1]}年`],
  ];

  for (const [pattern, transform] of patterns) {
    const match = display.match(pattern);
    if (match) {
      return transform(match);
    }
  }

  // Return original if no translation found
  return display;
}

/**
 * Get strength label in Japanese
 */
export function getStrengthLabel(score: PasswordStrength): string {
  const labels: Record<PasswordStrength, string> = {
    [PasswordStrength.VERY_WEAK]: '非常に弱い',
    [PasswordStrength.WEAK]: '弱い',
    [PasswordStrength.FAIR]: '普通',
    [PasswordStrength.GOOD]: '強い',
    [PasswordStrength.STRONG]: '非常に強い',
  };

  return labels[score];
}

/**
 * Get strength color for UI
 */
export function getStrengthColor(score: PasswordStrength): string {
  const colors: Record<PasswordStrength, string> = {
    [PasswordStrength.VERY_WEAK]: '#dc2626', // red-600
    [PasswordStrength.WEAK]: '#ea580c', // orange-600
    [PasswordStrength.FAIR]: '#ca8a04', // yellow-600
    [PasswordStrength.GOOD]: '#16a34a', // green-600
    [PasswordStrength.STRONG]: '#15803d', // green-700
  };

  return colors[score];
}

/**
 * Generate a secure random password
 * Uses crypto.getRandomValues for cryptographically secure randomness
 */
export function generateSecurePassword(
  length: number = 16,
  options: {
    includeLowercase?: boolean;
    includeUppercase?: boolean;
    includeNumbers?: boolean;
    includeSymbols?: boolean;
  } = {
    includeLowercase: true,
    includeUppercase: true,
    includeNumbers: true,
    includeSymbols: true,
  }
): string {
  let charset = '';

  if (options.includeLowercase) {
    charset += 'abcdefghijklmnopqrstuvwxyz';
  }
  if (options.includeUppercase) {
    charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }
  if (options.includeNumbers) {
    charset += '0123456789';
  }
  if (options.includeSymbols) {
    charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  }

  if (!charset) {
    throw new Error('At least one character set must be selected');
  }

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);

  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }

  return password;
}

/**
 * Check if existing password meets new requirements
 * Used for grandfathering existing users
 */
export function isGrandfatheredPassword(password: string): boolean {
  // Existing passwords must be at least 8 characters (old requirement)
  const OLD_MIN_LENGTH = 8;
  return password.length >= OLD_MIN_LENGTH && password.length < PASSWORD_REQUIREMENTS.MIN_LENGTH;
}

/**
 * Validate password for existing users (more lenient)
 */
export function validateExistingPassword(password: string): { isValid: boolean; message?: string } {
  if (!password || password.length === 0) {
    return { isValid: false, message: 'パスワードを入力してください' };
  }

  // Allow grandfathered passwords
  if (isGrandfatheredPassword(password)) {
    return {
      isValid: true,
      message: '次回パスワード変更時には、より強力なパスワードの設定をお願いします',
    };
  }

  // For non-grandfathered passwords, use standard validation
  const result = validatePasswordStrength(password);
  return {
    isValid: result.isValid,
    message: result.errors[0] || result.feedback.warning,
  };
}

/**
 * Simple password validation for testing
 * Returns validation result with English error messages
 */
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate password against basic requirements
 * Used for simple validation without strength scoring
 *
 * @param password - The password to validate
 * @returns Validation result with errors array
 */
export function validatePassword(password: unknown): PasswordValidationResult {
  const errors: string[] = [];

  // Handle null/undefined/non-string inputs
  if (!password || typeof password !== 'string') {
    errors.push('Password must be at least 12 characters long');
    errors.push('Password must contain at least one uppercase letter');
    errors.push('Password must contain at least one lowercase letter');
    errors.push('Password must contain at least one number');
    errors.push('Password must contain at least one special character');
    return { isValid: false, errors };
  }

  // Length validation
  if (password.length < PASSWORD_REQUIREMENTS.MIN_LENGTH) {
    errors.push('Password must be at least 12 characters long');
  }

  // Uppercase letter check
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Lowercase letter check
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Number check
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Special character check
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check for common weak passwords
  if (COMMON_WEAK_PASSWORDS.has(password)) {
    errors.push('This password is too common. Please choose a more unique password');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Password strength analysis result
 */
export interface PasswordStrengthAnalysis {
  score: number; // 0-100
  level: 'very-weak' | 'weak' | 'moderate' | 'strong' | 'very-strong';
  feedback: string[];
}

/**
 * Get detailed password strength analysis
 * Uses zxcvbn for entropy-based scoring
 *
 * @param password - The password to analyze
 * @returns Strength analysis with score and feedback
 */
export function getPasswordStrength(password: string): PasswordStrengthAnalysis {
  if (!password || password.length === 0) {
    return {
      score: 0,
      level: 'very-weak',
      feedback: [
        'Make it at least 12 characters',
        'Add uppercase letters',
        'Add lowercase letters',
        'Add numbers',
        'Add special characters',
      ],
    };
  }

  // Use zxcvbn for strength analysis
  const result = zxcvbn(password);

  // Convert zxcvbn score (0-4) to 0-100
  const score = Math.round((result.score / 4) * 100);

  // Determine strength level
  let level: 'very-weak' | 'weak' | 'moderate' | 'strong' | 'very-strong';
  if (score < 25) {
    level = 'very-weak';
  } else if (score < 50) {
    level = 'weak';
  } else if (score < 70) {
    level = 'moderate';
  } else if (score < 90) {
    level = 'strong';
  } else {
    level = 'very-strong';
  }

  // Build feedback array
  const feedback: string[] = [];

  // Check basic requirements
  if (password.length < 12) {
    feedback.push('Make it at least 12 characters');
  }
  if (!/[A-Z]/.test(password)) {
    feedback.push('Add uppercase letters');
  }
  if (!/[a-z]/.test(password)) {
    feedback.push('Add lowercase letters');
  }
  if (!/\d/.test(password)) {
    feedback.push('Add numbers');
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    feedback.push('Add special characters');
  }

  // Add zxcvbn suggestions
  if (result.feedback.warning) {
    feedback.push(result.feedback.warning);
  }
  if (result.feedback.suggestions) {
    feedback.push(...result.feedback.suggestions);
  }

  return {
    score,
    level,
    feedback,
  };
}

export default {
  validatePasswordStrength,
  validatePassword,
  getPasswordStrength,
  getStrengthLabel,
  getStrengthColor,
  generateSecurePassword,
  isGrandfatheredPassword,
  validateExistingPassword,
  PASSWORD_REQUIREMENTS,
  PasswordStrength,
};
