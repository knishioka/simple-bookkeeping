'use client';

import { Info } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  validatePasswordStrength,
  getStrengthLabel,
  getStrengthColor,
  type PasswordStrengthResult,
  PasswordStrength,
} from '@/lib/password-strength';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
  userInputs?: string[];
  showFeedback?: boolean;
  className?: string;
  onStrengthChange?: (result: PasswordStrengthResult) => void;
}

export function PasswordStrengthIndicator({
  password,
  userInputs = [],
  showFeedback = true,
  className,
  onStrengthChange,
}: PasswordStrengthIndicatorProps) {
  const [strength, setStrength] = useState<PasswordStrengthResult | null>(null);

  useEffect(() => {
    if (!password) {
      setStrength(null);
      return;
    }

    const result = validatePasswordStrength(password, userInputs);
    setStrength(result);
    onStrengthChange?.(result);
  }, [password, userInputs, onStrengthChange]);

  if (!password || !strength) {
    return null;
  }

  const strengthPercentage = ((strength.score + 1) / 5) * 100;
  const strengthColor = getStrengthColor(strength.score);
  const strengthLabel = getStrengthLabel(strength.score);

  return (
    <div className={cn('space-y-2', className)}>
      {/* Strength bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">パスワード強度</span>
          <span className="font-medium" style={{ color: strengthColor }}>
            {strengthLabel}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full transition-all duration-300 ease-out rounded-full"
            style={{
              width: `${strengthPercentage}%`,
              backgroundColor: strengthColor,
            }}
          />
        </div>
      </div>

      {/* Crack time estimate */}
      {strength.score >= PasswordStrength.FAIR && (
        <p className="text-xs text-muted-foreground">
          解読にかかる推定時間: <span className="font-medium">{strength.crackTime.display}</span>
        </p>
      )}

      {/* Feedback and suggestions */}
      {showFeedback && (
        <>
          {/* Errors */}
          {strength.errors.length > 0 && (
            <div className="space-y-1">
              {strength.errors.map((error, index) => (
                <div key={index} className="flex items-start gap-2 text-sm text-destructive">
                  <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              ))}
            </div>
          )}

          {/* Warning */}
          {strength.feedback.warning && (
            <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-500">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{strength.feedback.warning}</span>
            </div>
          )}

          {/* Suggestions */}
          {strength.feedback.suggestions.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">改善のヒント:</p>
              <ul className="space-y-1">
                {strength.feedback.suggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    className="text-xs text-muted-foreground pl-4 relative before:content-['•'] before:absolute before:left-0"
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Requirements checklist */}
      {password.length > 0 && (
        <div className="space-y-1 pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground">要件:</p>
          <ul className="space-y-0.5">
            <RequirementItem met={password.length >= 12} text="12文字以上" />
            <RequirementItem met={strength.score >= PasswordStrength.GOOD} text="十分な複雑性" />
            <RequirementItem
              met={!strength.errors.some((e) => e.includes('一般的すぎて'))}
              text="一般的なパスワードではない"
            />
          </ul>
        </div>
      )}
    </div>
  );
}

function RequirementItem({ met, text }: { met: boolean; text: string }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <div
        className={cn(
          'h-3 w-3 rounded-full flex items-center justify-center',
          met ? 'bg-green-600' : 'bg-muted'
        )}
      >
        {met && (
          <svg
            className="h-2 w-2 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className={cn(met ? 'text-foreground' : 'text-muted-foreground')}>{text}</span>
    </li>
  );
}

export default PasswordStrengthIndicator;
