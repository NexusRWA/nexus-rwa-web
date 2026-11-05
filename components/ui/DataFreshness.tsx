/** Shows when the currently displayed data was last retrieved. */
export function DataFreshness({ updatedAt }: { updatedAt: number | null }) {
  if (updatedAt === null || updatedAt === undefined) return null;

  const date = new Date(updatedAt);
  const formatted = date.toLocaleString();

  return (
    <p className="text-xs text-base-100/40">
      Figures retrieved{" "}
      <time dateTime={date.toISOString()}>{formatted}</time>. API-indexed data
      may lag the latest Stellar ledger.
    </p>
  );
}
