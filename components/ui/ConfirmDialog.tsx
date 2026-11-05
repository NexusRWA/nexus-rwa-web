"use client";

import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Dialog heading / title. */
  title: string;
  /** Descriptive body text shown below the title. */
  description: string;
  /** Label for the confirm (destructive) button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Called when the user presses the confirm button. */
  onConfirm: () => void;
  /** Called when the user presses Cancel or dismisses the dialog. */
  onCancel: () => void;
}

/**
 * A lightweight modal confirmation dialog for irreversible issuer actions.
 * Traps focus while open and closes on Escape.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus the Cancel button when the dialog opens (safe default for
  // destructive actions — pressing Enter won't accidentally confirm), and
  // return focus to the element that opened the dialog when it closes.
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => {
      if (trigger && trigger.isConnected) trigger.focus();
    };
  }, [open]);

  // Close on Escape; keep Tab / Shift+Tab cycling inside the dialog.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (!dialogRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default border-0 bg-black/60 p-0"
        aria-label="Dismiss confirmation dialog"
        onClick={onCancel}
      />

      {/* Dialog panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-base-900 p-6 shadow-xl"
      >
        {/* Icon */}
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path
              d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
              strokeLinejoin="round"
            />
            <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
          </svg>
        </div>

        <h2
          id="confirm-dialog-title"
          className="text-base font-semibold text-base-100"
        >
          {title}
        </h2>
        <p
          id="confirm-dialog-desc"
          className="mt-1.5 text-sm leading-relaxed text-base-100/60"
        >
          {description}
        </p>

        <div className="mt-5 flex gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="btn-secondary flex-1"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-base-900"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
