'use client';

import { useMemo } from 'react';

import { validatePassword, getPasswordStrength } from '@/lib/password-strength';

interface PasswordStrengthMeterProps {
  password: string;
  showRequirements?: boolean;
}

export function PasswordStrengthMeter({
  password,
  showRequirements = true,
}: PasswordStrengthMeterProps) {
  const validation = useMemo(() => validatePassword(password), [password]);
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  if (!password) {
    return null;
  }

  // Map strength level to color
  const getColorClass = (level: string) => {
    switch (level) {
      case 'very-weak':
        return 'bg-red-500';
      case 'weak':
        return 'bg-orange-500';
      case 'moderate':
        return 'bg-yellow-500';
      case 'strong':
        return 'bg-green-500';
      case 'very-strong':
        return 'bg-green-600';
      default:
        return 'bg-gray-200';
    }
  };

  // Map strength level to Japanese label
  const getJapaneseLabel = (level: string) => {
    switch (level) {
      case 'very-weak':
        return '非常に弱い';
      case 'weak':
        return '弱い';
      case 'moderate':
        return '普通';
      case 'strong':
        return '強い';
      case 'very-strong':
        return '非常に強い';
      default:
        return '弱い';
    }
  };

  // Calculate which bars to fill (0-4)
  const filledBars = Math.floor((strength.score / 100) * 4);
  const strengthColor = getColorClass(strength.level);
  const strengthLabel = getJapaneseLabel(strength.level);

  // Get requirements status
  const requirements = [
    {
      label: '12文字以上',
      met: password.length >= 12,
    },
    {
      label: '小文字を含む',
      met: /[a-z]/.test(password),
    },
    {
      label: '大文字を含む',
      met: /[A-Z]/.test(password),
    },
    {
      label: '数字を含む',
      met: /[0-9]/.test(password),
    },
    {
      label: '記号を含む',
      met: /[^a-zA-Z0-9]/.test(password),
    },
  ];

  return (
    <div className="mt-2 space-y-2">
      {/* Strength meter bars */}
      <div className="flex gap-1" role="progressbar" aria-valuenow={filledBars} aria-valuemax={4}>
        {[0, 1, 2, 3].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded transition-colors ${
              level <= filledBars ? strengthColor : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Strength label */}
      <p className="text-sm text-gray-600">
        パスワード強度: <span className="font-medium">{strengthLabel}</span>
      </p>

      {/* Requirements checklist */}
      {showRequirements && (
        <ul className="text-xs space-y-1 mt-2" aria-label="パスワード要件">
          {requirements.map((req, index) => (
            <li
              key={index}
              className={`flex items-center gap-2 ${req.met ? 'text-green-600' : 'text-gray-500'}`}
            >
              <span className="flex-shrink-0" aria-hidden="true">
                {req.met ? '✓' : '○'}
              </span>
              <span>{req.label}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Show validation errors if any */}
      {!validation.isValid && validation.errors.length > 0 && (
        <div className="text-xs text-red-600 mt-2">{validation.errors[0]}</div>
      )}
    </div>
  );
}
