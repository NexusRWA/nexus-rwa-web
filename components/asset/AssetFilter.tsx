"use client";

import { ASSET_TYPES, ASSET_TYPE_LABELS, type AssetType } from "@/types";

export type TypeFilter = AssetType | "all";
export type SortKey = "valuation" | "newest";

export interface FilterValue {
  type: TypeFilter;
  sort: SortKey;
}

interface AssetFilterProps {
  value: FilterValue;
  onChange: (next: FilterValue) => void;
  search: string;
  onSearchChange: (search: string) => void;
  /** Per-type counts, used to annotate the filter chips. */
  counts?: Record<TypeFilter, number>;
}

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All Assets" },
  ...ASSET_TYPES.map((t) => ({ value: t, label: ASSET_TYPE_LABELS[t] })),
];

/** Filter assets by class and choose a sort order. */
export function AssetFilter({
  value,
  onChange,
  search,
  onSearchChange,
  counts,
}: AssetFilterProps) {
  return (
    <div className="flex flex-col gap-4">
      <label className="sr-only" htmlFor="asset-search">Search assets</label>
      <input
        id="asset-search"
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search by name, ID, issuer or token"
        className="input w-full"
      />

      {/* #215 a11y: focus-visible rings added to filter chip buttons.
          #216 a11y: aria-label encodes the count so screen readers announce it
                     alongside the visible badge (e.g. "Real Estate, 12 assets").
          #218 a11y: inactive chip text bumped from /60 to /70. */}
      <div role="group" aria-label="Filter by asset type" className="flex flex-wrap gap-2 sm:gap-3">
        {TYPE_OPTIONS.map((opt) => {
          const active = value.type === opt.value;
          const count = counts?.[opt.value];
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...value, type: opt.value })}
              aria-pressed={active}
              aria-label={count !== undefined ? `${opt.label}, ${count} asset${count === 1 ? "" : "s"}` : opt.label}
              className={`chip border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-base-950 ${
                active
                  ? "border-brand-500/40 bg-brand-500/15 text-brand-200"
                  : "border-white/10 bg-white/[0.03] text-base-100/70 hover:text-base-100/90"
              }`}
            >
              {opt.label}
              {count !== undefined && (
                <span aria-hidden="true" className={active ? "text-brand-300/70" : "text-base-100/55"}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* #219 a11y: the <label> wraps the <select> so they're associated. The
          visible "Sort" text is hidden on small screens but the label element
          itself still provides the accessible name via the wrapping relationship.
          An aria-label is added to the <select> as a belt-and-suspenders for
          assistive technology that reads the select before the label text. */}
      <label className="flex items-center gap-2 text-sm text-base-100/60">
        <span className="hidden sm:inline">Sort</span>
        <select
          value={value.sort}
          onChange={(e) => onChange({ ...value, sort: e.target.value as SortKey })}
          aria-label="Sort assets"
          className="input w-full sm:w-auto cursor-pointer py-2 pr-8"
        >
          <option value="valuation">Highest valuation</option>
          <option value="newest">Newest</option>
        </select>
      </label>
    </div>
  );
}
