"use client";

import { formatDistanceToNow } from "date-fns";
import type { TransferActivity } from "@/hooks/useActivity";
import { formatTokenAmount, truncateAddress } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingPanel } from "@/components/ui/Spinner";

interface ActivityPanelProps {
  events: TransferActivity[] | null;
  loading: boolean;
  error: string | null;
  decimals: number;
  onRetry: () => void;
}

export function ActivityPanel({
  events,
  loading,
  error,
  decimals,
  onRetry,
}: ActivityPanelProps) {
  if (loading) return <LoadingPanel label="Loading transfer history…" />;
  if (error) {
    return (
      <ErrorState
        title="Couldn't load transfer history"
        message={error}
        onRetry={onRetry}
      />
    );
  }
  if (!events?.length) {
    return (
      <EmptyState
        title="No recent transfers"
        description="Recent indexed transfers for this asset will appear here."
        className="py-8"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-base-100/40">
          <tr>
            <th scope="col" className="pb-3 pr-4 font-medium">Amount</th>
            <th scope="col" className="pb-3 pr-4 font-medium">From</th>
            <th scope="col" className="pb-3 pr-4 font-medium">To</th>
            <th scope="col" className="pb-3 font-medium">When</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {events.map((event) => {
            const date = event.timestamp ? new Date(event.timestamp) : null;
            const when =
              date && !Number.isNaN(date.getTime())
                ? formatDistanceToNow(date, { addSuffix: true })
                : `Ledger ${event.ledger}`;

            return (
              <tr key={event.id}>
                <td className="py-3 pr-4 font-medium text-base-100">
                  {formatTokenAmount(event.amount, decimals)}
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-base-100/60" title={event.from}>
                  {truncateAddress(event.from, 6, 6)}
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-base-100/60" title={event.to}>
                  {truncateAddress(event.to, 6, 6)}
                </td>
                <td className="py-3 text-xs text-base-100/40">
                  <time dateTime={event.timestamp ?? undefined} title={`Ledger ${event.ledger}`}>
                    {when}
                  </time>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
