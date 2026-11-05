"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Root error boundary for the app segment. Next.js mounts this in place of
 * the page tree whenever a render/effect throws, keeping the site header and
 * footer (from layout.tsx) intact and offering a way back instead of a blank
 * screen.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center sm:px-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>
      <h1 className="text-xl font-semibold text-base-100">Something went wrong</h1>
      <p className="max-w-md text-sm text-base-100/60">
        An unexpected error interrupted this page. You can retry, or head back
        and try again from there.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/" className="btn-secondary">
          Go home
        </Link>
      </div>
    </div>
  );
}
