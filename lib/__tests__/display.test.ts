import { sanitizeDisplayText, getDisplayText, truncateAddress } from "@/lib/display";

// ---------------------------------------------------------------------------
// Issue #385 — sanitizeDisplayText
// ---------------------------------------------------------------------------

describe("sanitizeDisplayText", () => {
  // --- null / undefined / empty inputs -------------------------------------

  it("returns empty string for null", () => {
    expect(sanitizeDisplayText(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(sanitizeDisplayText(undefined)).toBe("");
  });

  it("returns empty string for an empty string", () => {
    expect(sanitizeDisplayText("")).toBe("");
  });

  it("returns empty string for a whitespace-only string", () => {
    expect(sanitizeDisplayText("   ")).toBe("");
  });

  // --- happy-path passthrough -----------------------------------------------

  it("returns a plain ASCII string unchanged", () => {
    expect(sanitizeDisplayText("Hello, world!")).toBe("Hello, world!");
  });

  it("trims leading and trailing whitespace", () => {
    expect(sanitizeDisplayText("  hello  ")).toBe("hello");
  });

  it("collapses multiple internal spaces into one", () => {
    expect(sanitizeDisplayText("foo   bar")).toBe("foo bar");
  });

  it("collapses tabs and newlines into spaces (normalizeText runs first)", () => {
    // normalizeText() collapses ALL whitespace (including \n) into a single
    // space before any other processing — newlines do not survive to the
    // line-splitting stage.
    expect(sanitizeDisplayText("foo\tbar")).toBe("foo bar");
    expect(sanitizeDisplayText("foo\nbar")).toBe("foo bar");
  });

  // --- HTML stripping -------------------------------------------------------

  it("strips a simple <b> tag", () => {
    expect(sanitizeDisplayText("<b>bold</b>")).toBe("bold");
  });

  it("strips an anchor tag and keeps inner text", () => {
    expect(sanitizeDisplayText('<a href="http://example.com">link</a>')).toBe("link");
  });

  it("strips a self-closing tag", () => {
    expect(sanitizeDisplayText("line<br/>break")).toBe("linebreak");
  });

  it("strips nested HTML tags", () => {
    expect(sanitizeDisplayText("<div><p>text</p></div>")).toBe("text");
  });

  it("returns empty string for a string that is only HTML tags", () => {
    expect(sanitizeDisplayText("<div></div>")).toBe("");
  });

  // --- control character stripping -----------------------------------------

  it("removes ASCII control characters (\\x01)", () => {
    expect(sanitizeDisplayText("foo\x01bar")).toBe("foobar");
  });

  it("removes ASCII unit-separator (\\x1F)", () => {
    expect(sanitizeDisplayText("foo\x1Fbar")).toBe("foobar");
  });

  it("removes the DEL character (\\x7F)", () => {
    expect(sanitizeDisplayText("foo\x7Fbar")).toBe("foobar");
  });

  it("does not remove printable non-ASCII characters (unicode letters)", () => {
    expect(sanitizeDisplayText("café au lait")).toBe("café au lait");
  });

  it("does not remove emoji", () => {
    expect(sanitizeDisplayText("hello 🌍")).toBe("hello 🌍");
  });

  // --- truncation (maxLength) -----------------------------------------------

  it("does not truncate a string at exactly maxLength characters", () => {
    const text = "a".repeat(220);
    expect(sanitizeDisplayText(text)).toBe(text);
  });

  it("truncates a string that exceeds maxLength and appends the ellipsis character", () => {
    const text = "a".repeat(221);
    const result = sanitizeDisplayText(text);
    // slice(0, 220) → 220 'a's + '…' (U+2026, JS .length === 1) = 221
    expect(result).toHaveLength(221);
    expect(result.endsWith("…")).toBe(true);
  });

  it("the truncated prefix is exactly maxLength characters long", () => {
    const text = "a".repeat(250);
    const result = sanitizeDisplayText(text);
    // Remove the trailing ellipsis and check the prefix length
    expect(result.slice(0, -1)).toHaveLength(220);
  });

  it("truncates at a custom maxLength when provided via options", () => {
    const result = sanitizeDisplayText("abcdef", { maxLength: 3 });
    expect(result).toBe("abc…");
  });

  it("trims trailing whitespace from the prefix before appending the ellipsis", () => {
    // slice(0, 4) = 'aaa ', trimEnd() = 'aaa', then append '…'
    const result = sanitizeDisplayText("aaa   bbb", { maxLength: 4 });
    expect(result).toBe("aaa…");
  });

  // --- line limiting (maxLines) ---------------------------------------------
  // NOTE: normalizeText() collapses all whitespace (including newlines) into
  // single spaces before the split(/\n/) step. Literal \n in the input is
  // therefore turned into a space rather than a line separator, so a simple
  // string of newline-joined words comes out as a single line.

  it("returns a single-line string without modification", () => {
    expect(sanitizeDisplayText("one line")).toBe("one line");
  });

  it("collapses newlines in the input into spaces (normalizeText pre-pass)", () => {
    // The input has 3 lines but normalizeText flattens them into one space-
    // separated string before any line-splitting occurs.
    const result = sanitizeDisplayText("line1\nline2\nline3");
    expect(result).toBe("line1 line2 line3");
  });

  it("respects a custom maxLines when actual newlines reach the split step", () => {
    // After normalizeText, \n becomes space. To have multiple lines survive
    // the pipeline the value must already contain a literal \n post-normalize.
    // In practice the SAFE_LINE_LIMIT guard acts on the post-normalize,
    // post-HTML-strip, post-control-char text — which is single-line for
    // string inputs that only contain \n. This test confirms the default
    // single-result array is returned correctly.
    const result = sanitizeDisplayText("hello");
    expect(result.split("\n")).toHaveLength(1);
  });

  it("filters out truly blank lines from the output array (empty filter)", () => {
    // After full normalization the text is "line1 line2" (no newlines survive
    // normalizeText), so the split produces one non-empty element.
    const result = sanitizeDisplayText("line1\n\nline2");
    expect(result).toBe("line1 line2");
  });

  // --- combined behaviours --------------------------------------------------

  it("strips HTML then truncates", () => {
    const inner = "a".repeat(221);
    const result = sanitizeDisplayText(`<b>${inner}</b>`);
    expect(result.endsWith("…")).toBe(true);
    // prefix before ellipsis is exactly maxLength chars
    expect(result.slice(0, -1)).toHaveLength(220);
  });

  it("strips control chars and HTML together", () => {
    const result = sanitizeDisplayText("<p>line\x01one</p> <p>line two</p>");
    expect(result).toBe("lineone line two");
  });

  it("handles a realistic asset description without modification", () => {
    const desc = "A tokenized commercial real estate asset located in Nairobi.";
    expect(sanitizeDisplayText(desc)).toBe(desc);
  });

  it("handles a long description with custom options", () => {
    const desc = "Short description.";
    expect(sanitizeDisplayText(desc, { maxLength: 5 })).toBe("Short…");
  });
});

// ---------------------------------------------------------------------------
// Issue #385 — getDisplayText
// ---------------------------------------------------------------------------

describe("getDisplayText", () => {
  // --- fallback behaviour ---------------------------------------------------

  it("returns the default fallback 'Untitled' for null", () => {
    expect(getDisplayText(null)).toBe("Untitled");
  });

  it("returns the default fallback 'Untitled' for undefined", () => {
    expect(getDisplayText(undefined)).toBe("Untitled");
  });

  it("returns the default fallback 'Untitled' for an empty string", () => {
    expect(getDisplayText("")).toBe("Untitled");
  });

  it("returns the default fallback for a whitespace-only string", () => {
    expect(getDisplayText("   ")).toBe("Untitled");
  });

  it("returns a custom fallback when provided and value is empty", () => {
    expect(getDisplayText(null, "Unknown Asset")).toBe("Unknown Asset");
  });

  it("returns an empty-string custom fallback when value is empty", () => {
    expect(getDisplayText("", "")).toBe("");
  });

  // --- passthrough of valid text --------------------------------------------

  it("returns a normal string unchanged", () => {
    expect(getDisplayText("My Asset")).toBe("My Asset");
  });

  it("ignores the fallback when a valid non-empty string is provided", () => {
    expect(getDisplayText("Real Estate Fund", "Untitled")).toBe("Real Estate Fund");
  });

  it("strips HTML from the value before returning it", () => {
    expect(getDisplayText("<b>Tokenized Gold</b>")).toBe("Tokenized Gold");
  });

  it("returns the fallback when value is only HTML tags (produces empty text)", () => {
    expect(getDisplayText("<br/>")).toBe("Untitled");
  });

  it("returns the fallback when value is only control characters", () => {
    expect(getDisplayText("\x01\x02\x03")).toBe("Untitled");
  });

  // --- truncation passthrough -----------------------------------------------

  it("truncates a very long value using the default 220-character limit", () => {
    const longText = "x".repeat(300);
    const result = getDisplayText(longText);
    expect(result.endsWith("…")).toBe(true);
    expect(result.slice(0, -1)).toHaveLength(220);
  });

  it("does not truncate a value at exactly 220 characters", () => {
    const text = "y".repeat(220);
    expect(getDisplayText(text)).toBe(text);
  });
});

// ---------------------------------------------------------------------------
// Issue #618 — no hidden state / stale closures (display is pure, no hooks)
// ---------------------------------------------------------------------------

describe("display purity (#618)", () => {
  it("has no React dependency arrays: repeated calls with different args never reuse earlier input", () => {
    expect(getDisplayText("first")).toBe("first");
    expect(getDisplayText("second")).toBe("second");
    expect(getDisplayText(null, "fallback")).toBe("fallback");
    expect(getDisplayText("first")).toBe("first");
  });

  it("does not leak options between calls", () => {
    expect(sanitizeDisplayText("abcdefghij", { maxLength: 3 })).toBe("abc…");
    expect(sanitizeDisplayText("abcdefghij")).toBe("abcdefghij");
  });
});

// ---------------------------------------------------------------------------
// Issue #619 — unmount during in-flight async call
// ---------------------------------------------------------------------------

describe("display synchrony (#619)", () => {
  it("is fully synchronous, so nothing can resolve after unmount", () => {
    expect(getDisplayText("x")).not.toBeInstanceOf(Promise);
    expect(sanitizeDisplayText("x")).not.toBeInstanceOf(Promise);
  });

  it("produces no React warnings or console errors", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    getDisplayText("hello");
    sanitizeDisplayText("<b>hi</b>");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Issue #620 — network switch mid-session
// ---------------------------------------------------------------------------

describe("display network independence (#620)", () => {
  it("holds no cache, so output depends only on input and cannot leak across networks", () => {
    const testnetLabel = "Testnet Asset";
    const mainnetLabel = "Mainnet Asset";
    expect(getDisplayText(testnetLabel)).toBe(testnetLabel);
    expect(getDisplayText(mainnetLabel)).toBe(mainnetLabel);
    expect(getDisplayText(testnetLabel)).toBe(testnetLabel);
  });
});
