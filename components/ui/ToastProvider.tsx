"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone?: "default" | "success" | "error";
}

interface ToastContextValue {
  addToast: (toast: Omit<ToastItem, "id">) => void;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, ...toast }]);
    window.setTimeout(() => dismissToast(id), 4000);
  }, [dismissToast]);

  useEffect(() => {
    return () => {
      setToasts([]);
    };
  }, []);

  const renderToast = (toast: ToastItem) => (
    <div
      key={toast.id}
      className="pointer-events-auto rounded-xl border border-white/10 bg-slate-900/95 p-3 shadow-2xl backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{toast.title}</p>
          {toast.description ? <p className="mt-1 text-sm text-slate-300">{toast.description}</p> : null}
        </div>
        <button type="button" onClick={() => dismissToast(toast.id)} className="text-sm text-slate-400 hover:text-white" aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );

  const value = useMemo(() => ({ addToast, dismissToast }), [addToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Persistent live regions: polite for info/success, assertive for errors.
          They are always mounted so announcements fire when toasts are added,
          and nothing here ever moves focus. */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4">
        <div role="status" aria-live="polite" aria-atomic="false" className="flex flex-col gap-2">
          {toasts.filter((t) => t.tone !== "error").map(renderToast)}
        </div>
        <div role="alert" aria-live="assertive" aria-atomic="false" className="flex flex-col gap-2">
          {toasts.filter((t) => t.tone === "error").map(renderToast)}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside a ToastProvider");
  }
  return context;
}
