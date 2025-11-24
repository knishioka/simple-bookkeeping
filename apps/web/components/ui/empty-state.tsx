import { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface EmptyStateProps {
  /**
   * Visual icon or illustration to display
   */
  icon: ReactNode;

  /**
   * Main heading text
   */
  title: string;

  /**
   * Explanatory text providing more context
   */
  description: string;

  /**
   * Optional CTA buttons or action components
   */
  action?: ReactNode;

  /**
   * Optional additional helpful tips
   */
  tips?: string[];

  /**
   * Optional className for custom styling
   */
  className?: string;
}

/**
 * EmptyState component for displaying when no data is available
 * Uses shadcn/ui styling patterns and Tailwind CSS
 * Includes fade-in animation and is fully accessible
 */
export function EmptyState({ icon, title, description, action, tips, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center animate-in fade-in-20 duration-500',
        className
      )}
    >
      {/* Icon Container */}
      <div className="mb-6 rounded-full bg-muted p-4" role="presentation" aria-hidden="true">
        <div className="h-12 w-12 text-muted-foreground">{icon}</div>
      </div>

      {/* Title */}
      <h3 className="mb-2 text-xl font-semibold text-foreground">{title}</h3>

      {/* Description */}
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">{description}</p>

      {/* Action Buttons */}
      {action && <div className="mb-6 flex flex-col gap-2 sm:flex-row">{action}</div>}

      {/* Tips Section */}
      {tips && tips.length > 0 && (
        <div
          className="mt-6 rounded-lg border border-border bg-muted/50 p-4 text-left"
          role="complementary"
          aria-label="追加のヒント"
        >
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            ヒント
          </p>
          <ul className="space-y-1">
            {tips.map((tip, index) => (
              <li key={index} className="flex items-start text-sm text-muted-foreground">
                <span className="mr-2 mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground/50" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
