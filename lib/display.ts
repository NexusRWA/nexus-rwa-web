const SAFE_TEXT_LIMIT = 220;
const SAFE_LINE_LIMIT = 8;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function sanitizeDisplayText(value: string | null | undefined, options?: { maxLength?: number; maxLines?: number }) {
  const text = normalizeText(value);
  const maxLength = options?.maxLength ?? SAFE_TEXT_LIMIT;
  const maxLines = options?.maxLines ?? SAFE_LINE_LIMIT;

  if (!text) {
    return "";
  }

  const normalized = text
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ");

  const truncated = normalized.length > maxLength ? `${normalized.slice(0, maxLength).trimEnd()}…` : normalized;
  const lines = truncated.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const collapsed = lines.slice(0, maxLines).join("\n");

  return collapsed;
}

export function getDisplayText(value: string | null | undefined, fallback = "Untitled") {
  const text = sanitizeDisplayText(value, { maxLength: SAFE_TEXT_LIMIT, maxLines: SAFE_LINE_LIMIT });
  return text || fallback;
}

/** Truncate a Stellar address for display: shows first 8 and last 8 characters. */
export function truncateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}…${address.slice(-8)}`;
}
