import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  /** Heading level for the title so it never skips a level in context. */
  headingLevel?: 1 | 2 | 3 | 4;
  className?: string;
}

/** Neutral placeholder shown when a query returns no data. */
export function EmptyState({
  title,
  description,
  icon,
  action,
  headingLevel = 3,
  className = "",
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center ${className}`}
    >
      {icon && <div className="text-base-100/55">{icon}</div>}
      <div>
        <Heading className="text-base font-semibold text-base-100">{title}</Heading>
        {description && (
          <p className="mx-auto mt-1 max-w-sm text-sm text-base-100/55">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
