import type { ComplianceStatus } from "@/types";

type Status = ComplianceStatus | "None";

interface Style {
  bg: string;
  text: string;
  dot: string;
  label: string;
}

const STYLES: Record<Status, Style> = {
  Approved: {
    bg: "border-brand-500/25 bg-brand-500/10",
    text: "text-brand-300",
    dot: "bg-brand-400",
    label: "Approved",
  },
  Pending: {
    bg: "border-gold-500/25 bg-gold-500/10",
    text: "text-gold-300",
    dot: "bg-gold-400",
    label: "Pending",
  },
  Suspended: {
    bg: "border-orange-500/25 bg-orange-500/10",
    text: "text-orange-300",
    dot: "bg-orange-400",
    label: "Suspended",
  },
  Rejected: {
    bg: "border-red-500/25 bg-red-500/10",
    text: "text-red-300",
    dot: "bg-red-400",
    label: "Rejected",
  },
  None: {
    bg: "border-white/10 bg-white/5",
    text: "text-base-100/55",
    dot: "bg-base-100/40",
    label: "Not Registered",
  },
};

interface ComplianceBadgeProps {
  status: Status;
  /** When set, overrides the label (e.g. "Expired" for a lapsed approval). */
  labelOverride?: string;
  className?: string;
}

/** Status pill for an address's KYC/compliance standing. */
export function ComplianceBadge({ status, labelOverride, className = "" }: ComplianceBadgeProps) {
  const s = STYLES[status];
  const label = labelOverride ?? s.label;
  return (
    <span
      role="status"
      aria-label={label}
      className={`chip border ${s.bg} ${s.text} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {label}
    </span>
  );
}
