import {
  compactNumber,
  formatRawPlain,
  formatStroopsToXLM,
  formatTokenAmount,
  formatUsdCents,
  holderSharePercentages,
  parseTokenAmount,
} from "@/lib/format";

// ---------------------------------------------------------------------------
// formatStroopsToXLM
// ---------------------------------------------------------------------------
describe("formatStroopsToXLM", () => {
  it("formats zero stroops", () => {
    expect(formatStroopsToXLM(0n)).toBe("0 XLM");
  });

  it("formats 1 stroop", () => {
    expect(formatStroopsToXLM(1n)).toBe("0.0000001 XLM");
  });

  it("formats 10,000,000 stroops (1 XLM) as whole unit", () => {
    expect(formatStroopsToXLM(10_000_000n)).toBe("1 XLM");
  });

  it("formats 15,000,000 stroops (1.5 XLM)", () => {
    expect(formatStroopsToXLM(15_000_000n)).toBe("1.5 XLM");
  });

  it("formats 10,100,000 stroops with leading zeros", () => {
    expect(formatStroopsToXLM(10_100_000n)).toBe("1.01 XLM");
  });

  it("formats 10,000,100 stroops with trailing precision", () => {
    expect(formatStroopsToXLM(10_000_100n)).toBe("1.00001 XLM");
  });

  it("formats 100,000,000 stroops (10 XLM)", () => {
    expect(formatStroopsToXLM(100_000_000n)).toBe("10 XLM");
  });

  it("handles number input", () => {
    expect(formatStroopsToXLM(10_000_000)).toBe("1 XLM");
  });

  it("handles large network fees (few hundred stroops)", () => {
    // Typical Soroban fee is around 100,000 stroops
    expect(formatStroopsToXLM(100_000n)).toBe("0.01 XLM");
  });

  it("removes trailing zeros in fractional part", () => {
    expect(formatStroopsToXLM(50_000_000n)).toBe("5 XLM");
    expect(formatStroopsToXLM(51_000_000n)).toBe("5.1 XLM");
    expect(formatStroopsToXLM(51_100_000n)).toBe("5.11 XLM");
  });
});

// ---------------------------------------------------------------------------
describe("formatUsdCents", () => {
  // --- whole dollar amounts ------------------------------------------------

  it("formats zero cents as $0", () => {
    expect(formatUsdCents(0n)).toBe("$0");
  });

  it("formats zero cents in compact mode as $0", () => {
    expect(formatUsdCents(0n, { compact: true })).toBe("$0");
  });

  it("formats exactly $1 (100 cents)", () => {
    expect(formatUsdCents(100n)).toBe("$1");
  });

  it("formats $5,000,000 (500_000_000 cents)", () => {
    expect(formatUsdCents(500_000_000n)).toBe("$5,000,000");
  });

  it("formats whole dollars without cents fraction", () => {
    // 1_000 cents = $10.00 → implementation omits trailing .00 for whole dollars
    expect(formatUsdCents(1_000n)).toBe("$10");
  });

  // --- fractional cents (sub-dollar) ---------------------------------------

  it("formats $0.01 (1 cent)", () => {
    expect(formatUsdCents(1n)).toBe("$0.01");
  });

  it("formats $0.50 (50 cents)", () => {
    expect(formatUsdCents(50n)).toBe("$0.50");
  });

  it("formats $1.99 (199 cents)", () => {
    expect(formatUsdCents(199n)).toBe("$1.99");
  });

  it("formats $1,234.56 (123456 cents)", () => {
    expect(formatUsdCents(123_456n)).toBe("$1,234.56");
  });

  // --- compact mode --------------------------------------------------------

  it("does NOT use compact format below 1,000,000 dollars", () => {
    // $999,999.99 — just under the compact threshold
    expect(formatUsdCents(99_999_999n, { compact: true })).toBe("$999,999.99");
  });

  it("formats exactly $1,000,000 in compact mode as $1M", () => {
    expect(formatUsdCents(100_000_000n, { compact: true })).toBe("$1M");
  });

  it("formats $1,500,000 in compact mode as $1.5M", () => {
    expect(formatUsdCents(150_000_000n, { compact: true })).toBe("$1.5M");
  });

  it("formats $12,300,000 in compact mode as $12.3M", () => {
    expect(formatUsdCents(1_230_000_000n, { compact: true })).toBe("$12.3M");
  });

  it("rounds compact values to one decimal without promoting early", () => {
    expect(formatUsdCents(104_999_999n, { compact: true })).toBe("$1M");
    expect(formatUsdCents(105_000_000n, { compact: true })).toBe("$1.1M");
  });

  it("promotes a rounded compact value at the next unit boundary", () => {
    expect(formatUsdCents(99_999_999_900n, { compact: true })).toBe("$1B");
  });

  it("formats $2,000,000,000 in compact mode as $2B", () => {
    expect(formatUsdCents(200_000_000_000n, { compact: true })).toBe("$2B");
  });

  it("passes large compact values through without compact flag (no shorthand)", () => {
    expect(formatUsdCents(100_000_000n)).toBe("$1,000,000");
  });

  // --- bigint precision ------------------------------------------------
  // formatUsdCents keeps values in bigint until the final string conversion, so
  // it stays exact well past Number.MAX_SAFE_INTEGER (2^53-1 cents ≈ $90T).

  it("preserves precision for a large value within safe integer range", () => {
    // 9_000_000_000_000n cents = $90,000,000,000 — still within Number safe range
    expect(formatUsdCents(9_000_000_000_000n)).toBe("$90,000,000,000");
  });

  it("preserves precision for a value exceeding Number.MAX_SAFE_INTEGER", () => {
    // 10_000_000_000_000_000n cents = $100,000,000,000,000 (~$100 trillion)
    // Converting via Number() would silently round; bigint math does not.
    expect(formatUsdCents(10_000_000_000_000_000n)).toBe("$100,000,000,000,000");
  });

  it("formats the maximum positive i128 with exact separators and cents", () => {
    expect(formatUsdCents(170141183460469231731687303715884105727n)).toBe(
      "$1,701,411,834,604,692,317,316,873,037,158,841,057.27",
    );
  });

  it("formats compact maximum i128 values without floating-point notation", () => {
    expect(formatUsdCents(170141183460469231731687303715884105727n, { compact: true })).toBe(
      "$1,701,411,834,604,692,317,316,873,037.2B",
    );
  });

  it("preserves compact valuation precision above Number.MAX_SAFE_INTEGER", () => {
    expect(formatUsdCents(900_719_925_474_099_345n, { compact: true })).toBe(
      "$9,007,199.3B",
    );
  });
});

// ---------------------------------------------------------------------------
// Issue #36 — formatTokenAmount
// ---------------------------------------------------------------------------
describe("formatTokenAmount", () => {
  // --- decimals = 0 --------------------------------------------------------

  it("formats an integer token with 0 decimals", () => {
    expect(formatTokenAmount(1000n, 0)).toBe("1,000");
  });

  it("formats zero with 0 decimals", () => {
    expect(formatTokenAmount(0n, 0)).toBe("0");
  });

  it("formats 1 with 0 decimals", () => {
    expect(formatTokenAmount(1n, 0)).toBe("1");
  });

  // --- trailing-zero trimming ----------------------------------------------

  it("trims trailing zeros from fractional part", () => {
    // 150000 raw, 5 decimals → 1.50000 → trimmed to "1.5"
    expect(formatTokenAmount(150_000n, 5)).toBe("1.5");
  });

  it("trims all fractional zeros when fraction is exactly zero", () => {
    // 100 raw, 2 decimals → 1.00 → whole only: "1"
    expect(formatTokenAmount(100n, 2)).toBe("1");
  });

  it("keeps significant fractional digits and trims only trailing zeros", () => {
    // 10500 raw, 4 decimals → 1.0500 → "1.05"
    expect(formatTokenAmount(10_500n, 4)).toBe("1.05");
  });

  it("does not trim non-trailing zeros", () => {
    // 1050 raw, 4 decimals → 0.1050 → "0.105"
    expect(formatTokenAmount(1_050n, 4)).toBe("0.105");
  });

  // --- negative amounts ----------------------------------------------------

  it("formats a negative integer token with 0 decimals", () => {
    expect(formatTokenAmount(-500n, 0)).toBe("-500");
  });

  it("formats a negative fractional amount", () => {
    // -199 raw, 2 decimals → -1.99
    expect(formatTokenAmount(-199n, 2)).toBe("-1.99");
  });

  it("formats negative zero-fraction as negative integer", () => {
    // -100 raw, 2 decimals → -1.00 → "-1"
    expect(formatTokenAmount(-100n, 2)).toBe("-1");
  });

  it("trims trailing zeros on negative fractional amounts", () => {
    // -15000 raw, 4 decimals → -1.5000 → "-1.5"
    expect(formatTokenAmount(-15_000n, 4)).toBe("-1.5");
  });

  // --- grouping separators -------------------------------------------------

  it("applies thousand-grouping to whole part", () => {
    // 1_000_000 raw, 0 decimals → "1,000,000"
    expect(formatTokenAmount(1_000_000n, 0)).toBe("1,000,000");
  });

  it("applies thousand-grouping with decimals", () => {
    // 1_234_567_89 raw, 2 decimals → 12,345,678.9 → "12,345,678.9"
    expect(formatTokenAmount(1_234_567_890n, 2)).toBe("12,345,678.9");
  });

  it("applies grouping to negative whole part", () => {
    expect(formatTokenAmount(-1_000_000n, 0)).toBe("-1,000,000");
  });

  // --- standard decimal cases ----------------------------------------------

  it("formats 100000 raw at 2 decimals as 1,000", () => {
    // The README example: 100000n @ 2 decimals → "1,000"
    expect(formatTokenAmount(100_000n, 2)).toBe("1,000");
  });

  it("formats 1 raw at 6 decimals (Stellar-style) as 0.000001", () => {
    expect(formatTokenAmount(1n, 6)).toBe("0.000001");
  });

  it("formats 10_000_000 raw at 7 decimals as 1", () => {
    expect(formatTokenAmount(10_000_000n, 7)).toBe("1");
  });
});

// ---------------------------------------------------------------------------
// Issue #250 — parseTokenAmount
// ---------------------------------------------------------------------------
describe("parseTokenAmount", () => {
  // --- accepted inputs -------------------------------------------------------

  it("accepts and parses single digit '5'", () => {
    expect(parseTokenAmount("5", 2)).toBe(500n);
  });

  it("accepts and parses decimal '5.5' at 2 decimals", () => {
    expect(parseTokenAmount("5.5", 2)).toBe(550n);
  });

  it("accepts and parses leading-decimal '.5' at 2 decimals", () => {
    expect(parseTokenAmount(".5", 2)).toBe(50n);
  });

  // --- rejected inputs -------------------------------------------------------

  it("rejects empty string", () => {
    expect(() => parseTokenAmount("", 2)).toThrow();
  });

  it("rejects a lone dot '.'", () => {
    expect(() => parseTokenAmount(".", 2)).toThrow();
  });

  it("rejects trailing dot '5.'", () => {
    expect(() => parseTokenAmount("5.", 2)).toThrow();
  });

  it("rejects negative number '-5'", () => {
    expect(() => parseTokenAmount("-5", 2)).toThrow();
  });

  it("rejects scientific notation '1e5'", () => {
    expect(() => parseTokenAmount("1e5", 2)).toThrow();
  });

  // --- decimal place limits --------------------------------------------------

  it("rejects input with more decimal places than allowed", () => {
    // "1.123" has 3 decimal places, but max is 2
    expect(() => parseTokenAmount("1.123", 2)).toThrow();
  });

  it("accepts input with exactly the allowed decimal places", () => {
    // "1.12" has 2 decimal places, max is 2
    expect(parseTokenAmount("1.12", 2)).toBe(112n);
  });

  // --- comma handling --------------------------------------------------------

  it("strips commas from input before parsing", () => {
    // "1,000.5" → removes commas → "1000.5" → parses correctly
    expect(parseTokenAmount("1,000.5", 2)).toBe(100050n);
  });

  it("handles multiple commas correctly", () => {
    expect(parseTokenAmount("1,000,000.25", 2)).toBe(100000025n);
  });

  // --- whitespace handling ---------------------------------------------------

  it("trims leading and trailing whitespace", () => {
    expect(parseTokenAmount("  5.5  ", 2)).toBe(550n);
  });

  // --- zero-decimals case ---------------------------------------------------

  it("parses at 0 decimals (integer-only token)", () => {
    expect(parseTokenAmount("100", 0)).toBe(100n);
  });

  it("rejects fractional input when decimals=0", () => {
    expect(() => parseTokenAmount("1.5", 0)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Issue #251 — formatRawPlain & round-trip with parseTokenAmount
// ---------------------------------------------------------------------------
describe("formatRawPlain", () => {
  // --- round-trip tests ------------------------------------------------------

  it("round-trips a whole number through parseTokenAmount", () => {
    const input = "5";
    const parsed = parseTokenAmount(input, 2);
    const formatted = formatRawPlain(parsed, 2);
    expect(formatted).toBe("5");
  });

  it("round-trips a decimal number through parseTokenAmount", () => {
    const input = "5.5";
    const parsed = parseTokenAmount(input, 2);
    const formatted = formatRawPlain(parsed, 2);
    expect(formatted).toBe("5.5");
  });

  it("round-trips a leading-decimal number through parseTokenAmount", () => {
    const input = ".5";
    const parsed = parseTokenAmount(input, 2);
    const formatted = formatRawPlain(parsed, 2);
    expect(formatted).toBe("0.5");
  });

  it("round-trips a large number with many digits", () => {
    const input = "1000000.12";
    const parsed = parseTokenAmount(input, 2);
    const formatted = formatRawPlain(parsed, 2);
    expect(formatted).toBe("1000000.12");
  });

  it("round-trips a number at max decimal precision", () => {
    const input = "1.123456";
    const parsed = parseTokenAmount(input, 6);
    const formatted = formatRawPlain(parsed, 6);
    expect(formatted).toBe("1.123456");
  });

  // --- trailing zero handling ------------------------------------------------

  it("trims trailing zeros from formatted output", () => {
    // Input "1.50" with 2 decimals: parses to 150n, formats back without trailing zero
    const parsed = parseTokenAmount("1.5", 2);
    const formatted = formatRawPlain(parsed, 2);
    expect(formatted).toBe("1.5");
  });

  it("preserves significant zeros but trims trailing zeros", () => {
    // "1.05" parses to 105n (at 2 decimals), formats to "1.05" (no trailing zero)
    const parsed = parseTokenAmount("1.05", 2);
    const formatted = formatRawPlain(parsed, 2);
    expect(formatted).toBe("1.05");
  });

  it("trims all fractional zeros when fraction is exactly zero", () => {
    const parsed = parseTokenAmount("1", 2);
    const formatted = formatRawPlain(parsed, 2);
    expect(formatted).toBe("1");
  });

  it("handles value with many trailing zeros", () => {
    // Raw 100n with 6 decimals = 0.0001, but formatRawPlain should trim to "0.0001"
    const raw = 100n;
    const formatted = formatRawPlain(raw, 6);
    expect(formatted).toBe("0.0001");
  });

  // --- no thousands separators -----------------------------------------------

  it("does not include thousands separators (unlike formatTokenAmount)", () => {
    const raw = 1_000_000n;
    const formatted = formatRawPlain(raw, 2);
    expect(formatted).toBe("10000");
    expect(formatted).not.toMatch(/,/);
  });

  // --- negative amounts ------------------------------------------------------

  it("formats negative raw amounts with leading minus", () => {
    const raw = -500n;
    const formatted = formatRawPlain(raw, 2);
    expect(formatted).toBe("-5");
  });

  it("round-trips negative amounts (if input were to be accepted)", () => {
    // Note: parseTokenAmount rejects negative input, so this tests formatRawPlain's negative handling
    const raw = -550n;
    const formatted = formatRawPlain(raw, 2);
    expect(formatted).toBe("-5.5");
  });
});

// ---------------------------------------------------------------------------
// Issue #252 — compactNumber
// ---------------------------------------------------------------------------
describe("compactNumber", () => {
  // --- sub-1000 (no compaction) ----------------------------------------------

  it("does not compact values below 1,000", () => {
    expect(compactNumber(999)).toBe("999");
  });

  it("does not compact value exactly 999", () => {
    expect(compactNumber(999)).toBe("999");
  });

  it("returns plain string for 0", () => {
    expect(compactNumber(0)).toBe("0");
  });

  it("returns plain string for 1", () => {
    expect(compactNumber(1)).toBe("1");
  });

  // --- K threshold (1,000) ---------------------------------------------------

  it("compacts exactly 1,000 as '1K'", () => {
    expect(compactNumber(1_000)).toBe("1K");
  });

  it("compacts 1,200 as '1.2K'", () => {
    expect(compactNumber(1_200)).toBe("1.2K");
  });

  it("compacts 12,345 as '12.3K'", () => {
    expect(compactNumber(12_345)).toBe("12.3K");
  });

  it("compacts 999,999 as '1000K'", () => {
    // 999999 / 1000 = 999.999, toFixed(1) = "1000.0", trimZero = "1000"
    expect(compactNumber(999_999)).toBe("1000K");
  });

  // --- M threshold (1,000,000) -----------------------------------------------

  it("compacts exactly 1,000,000 as '1M'", () => {
    expect(compactNumber(1_000_000)).toBe("1M");
  });

  it("compacts 1,500,000 as '1.5M'", () => {
    expect(compactNumber(1_500_000)).toBe("1.5M");
  });

  it("compacts 12,345,678 as '12.3M'", () => {
    expect(compactNumber(12_345_678)).toBe("12.3M");
  });

  it("compacts 999,999,999 as '1000M'", () => {
    // Just below 1B, should still use M suffix
    expect(compactNumber(999_999_999)).toBe("1000M");
  });

  // --- B threshold (1,000,000,000) -------------------------------------------

  it("compacts exactly 1,000,000,000 as '1B'", () => {
    expect(compactNumber(1_000_000_000)).toBe("1B");
  });

  it("compacts 2,500,000,000 as '2.5B'", () => {
    expect(compactNumber(2_500_000_000)).toBe("2.5B");
  });

  it("compacts 12,345,678,901 as '12.3B'", () => {
    expect(compactNumber(12_345_678_901)).toBe("12.3B");
  });

  // --- negative numbers ------------------------------------------------------

  it("compacts absolute value of negative numbers", () => {
    expect(compactNumber(-1_000_000)).toBe("-1M");
  });

  it("does not compact negative values below -1000", () => {
    expect(compactNumber(-999)).toBe("-999");
  });

  // --- decimal rounding (trimZero behavior) ---------------------------------

  it("trims .0 suffix from rounded values", () => {
    // 1000000 / 1000000 = 1.0 → trimmed to "1"
    expect(compactNumber(1_000_000)).toBe("1M");
  });

  it("keeps single decimal when significant", () => {
    // 1234567 / 1000000 = 1.234567, toFixed(1) = "1.2" (not trimmed)
    expect(compactNumber(1_234_567)).toBe("1.2M");
  });
});

describe("holderSharePercentages", () => {
  it("keeps a small positive holder visible", () => {
    expect(holderSharePercentages([1n, 999_999n], 1_000_000n)).toEqual([
      "0.01",
      "99.99",
    ]);
  });

  it("allocates rounding remainder so full-supply shares total 100 percent", () => {
    expect(holderSharePercentages([1n, 1n, 1n], 3n)).toEqual([
      "33.34",
      "33.33",
      "33.33",
    ]);
  });

  it("uses more precision when required to keep a small holder visible", () => {
    const shares = holderSharePercentages([1n, 1n], 1_000_000n);
    expect(shares[0]).toBe("0.0001");
    expect(shares[1]).toBe("0.0001");
  });
});
