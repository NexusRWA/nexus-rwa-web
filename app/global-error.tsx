"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Last-resort boundary for errors thrown by the root layout itself (where
 * app/error.tsx can't help, since it renders inside that same layout). Must
 * render its own <html>/<body> — this replaces the entire root layout tree.
 */
export default function GlobalError({
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
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-semibold text-base-100">Something went wrong</h1>
        <p className="max-w-md text-sm text-base-100/60">
          The app hit an unexpected error and couldn&apos;t render. Try
          reloading the page.
        </p>
        <button onClick={reset} className="btn-primary">
          Try again
        </button>
      </body>
    </html>
  );
}
