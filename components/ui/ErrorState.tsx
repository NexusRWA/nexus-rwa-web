interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  /** Heading level for the title so it never skips a level in context. */
  headingLevel?: 1 | 2 | 3 | 4;
  retryLabel?: string;
  className?: string;
}

/** Inline error panel with an optional retry affordance. */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  headingLevel = 3,
  retryLabel = "Try again",
  className = "",
}: ErrorStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 px-6 py-14 text-center ${className}`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500/10 text-red-400">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>
      <div>
        <Heading className="text-base font-semibold text-base-100">{title}</Heading>
        <p className="mx-auto mt-1 max-w-md text-sm text-base-100/60">{message}</p>
      </div>
      {onRetry && (
        <button type="button" onClick={() => onRetry()} className="btn-secondary mt-1">
          {retryLabel}
        </button>
      )}
    </div>
  );
}
