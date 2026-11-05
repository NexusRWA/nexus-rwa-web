interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
  /**
   * Hide the spinner from assistive technology. Set this when an ancestor is
   * already a live region announcing the same state: nested live regions are
   * announced unreliably, and the spinner's "Loading" would be read on top of
   * the panel's own label.
   */
  decorative?: boolean;
}

/**
 * Minimal accessible spinner. Under `prefers-reduced-motion` (see
 * app/globals.css) the rotation is replaced by a slow opacity pulse, so the
 * loading state stays perceivable without spinning motion.
 */
export function Spinner({
  size = 20,
  className = "",
  label,
  decorative = false,
}: SpinnerProps) {
  return (
    <span
      role={decorative ? undefined : "status"}
      aria-label={decorative ? undefined : (label ?? "Loading")}
      aria-hidden={decorative || undefined}
      className={`inline-block animate-spin rounded-full border-2 border-white/20 border-t-brand-400 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Full-panel loading state used inside cards and page sections. */
export function LoadingPanel({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 py-16 text-base-100/55"
    >
      <Spinner size={28} decorative />
      <p className="text-sm">{label}</p>
    </div>
  );
}
