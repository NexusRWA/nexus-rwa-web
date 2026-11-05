import type { ReactNode } from "react";

interface ActionCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  /** Optional accent class for the icon background, defaults to brand. */
  accent?: string;
}

/**
 * Consistent wrapper for each issuer action: icon, title, description, then
 * the form content below a divider.
 */
export function ActionCard({ title, description, icon, children, accent = "bg-brand-500/10 text-brand-400" }: ActionCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent}`}>
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-base-100">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-base-100/55">{description}</p>
        </div>
      </div>
      <div className="mt-4 border-t border-white/5 pt-4">
        {children}
      </div>
    </div>
  );
}
