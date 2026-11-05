/**
 * WCAG 2.1 AA Compliance Verification for Skip Link
 *
 * This document verifies the SkipLink implementation against WCAG 2.1 AA standards.
 *
 * ## Applicable Success Criteria
 *
 * ### 2.4.1 Bypass Blocks (Level A)
 * "A mechanism is available to bypass blocks of content that are repeated on
 * multiple Web pages."
 *
 * **Status: COMPLIANT**
 * - SkipLink is the first interactive element in the tab order
 * - It appears at the top of every page in the root layout
 * - Pressing Tab immediately reveals the link (it's not hidden permanently)
 * - Activating it jumps directly to the main content area
 * - This effectively bypasses the entire header navigation block
 *
 * ### 2.4.3 Focus Order (Level A)
 * "If a Web page can be navigated sequentially and the navigation sequences
 * affect meaning or operation, focusable components receive focus in an order
 * that preserves meaning and operability."
 *
 * **Status: COMPLIANT**
 * - SkipLink appears first in the DOM (before SiteHeader)
 * - It has a logical focus order: appears before all header elements
 * - After activation, focus moves to main-content element (tabIndex={-1})
 * - This preserves navigation operability by allowing keyboard users to skip
 *   the header and access main content directly
 *
 * ### 2.4.7 Focus Visible (Level AA)
 * "Any keyboard operable user interface has a mode of operation where the
 * keyboard focus indicator is visible."
 *
 * **Status: COMPLIANT**
 * - SkipLink has clear focus styling:
 *   - Brand-colored background (focus:bg-brand-400)
 *   - Visible outline ring (focus:ring-2 focus:ring-brand-600)
 *   - Ring offset for visual separation (focus:ring-offset-2)
 *   - Fixed positioning ensures it's never obscured
 * - focus:not-sr-only ensures focus styles are applied when focused
 * - The contrast ratio of brand-400 (#10b981) on base-950 (#08090c) is > 4.5:1
 *   meeting AA standards for text and UI components
 *
 * ### 1.4.11 Non-text Contrast (Level AA)
 * "The visual presentation of the following have a contrast ratio of at least
 * 3:1 against adjacent color(s)..."
 *
 * **Status: COMPLIANT**
 * - Focus ring (brand-600 #059669) on base-950 (#08090c) has contrast > 3:1
 * - The entire skip link button provides sufficient contrast for identification
 *
 * ## Implementation Details
 *
 * ### Visibility
 * - Uses `sr-only` class: hides from visual display but remains in DOM for screen readers
 * - Uses `focus:not-sr-only`: removes sr-only styles on focus, making link visible
 *
 * ### Accessibility
 * - Semantic HTML: uses <a> element (native link semantics)
 * - Keyboard accessible: Tab key reveals it, Enter/Space activates it
 * - Works with screen readers: text \"Skip to main content\" is descriptive
 * - programmatic focus management: main-content has tabIndex={-1} to receive focus
 *
 * ### Tested Scenarios
 * 1. ✓ Link renders and is in DOM
 * 2. ✓ Visually hidden by default (sr-only applied)
 * 3. ✓ Focus styles appear on keyboard focus
 * 4. ✓ Click or Enter activates the skip action
 * 5. ✓ Smooth scroll to main content
 * 6. ✓ Graceful error handling if main-content missing\n *
 * ## Test Coverage
 * See: components/layout/__tests__/SkipLink.test.tsx
 * - 8 test cases covering all functionality
 * - All tests pass (automated testing via Jest)
 * - Tests verify both automated compliance (sr-only, focus styles) and
 *   functional compliance (navigation works correctly)\n */
