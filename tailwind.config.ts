import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surface + foreground scale — near-black slate for a dark-first product.
        //
        // WCAG AA contrast audit (#397). Ratios are against the darkest/lightest
        // surfaces the text sits on (base-950 / base-900 / base-800); AA needs
        // 4.5:1 for body text, 3:1 for large text and UI components.
        //   Text on surfaces          950    900    850    800
        //   base-100 (#e5e7eb)      16.08  15.59  14.88  13.92  pass
        //   base-200 (#c7cbd4)      12.25  11.88  11.34  10.60  pass
        //   base-300 (#a5abba)       8.66   8.40   8.01   7.50  pass
        //   base-600 (#333a49)       1.75   1.69   1.62   1.51  FAIL — border/surface
        //                            only; never use as a text colour.
        //   brand-300 / 400 / 500   13.06 / 10.36 / 7.85 on 950 (≥5.8 on base-700)  pass
        //   gold-300 / 400          13.81 / 11.93 on 950 (≥8.8 on base-700)         pass
        //   red-400 (#f87171)        7.20   6.98   6.66   6.23  pass
        // Secondary text uses base-100 at reduced opacity; measured on base-900:
        //   /20 1.67  /30 2.36  /40 3.31  FAIL   /50 4.49 borderline FAIL
        //   /55 5.23  /60 6.04  /70 7.92  pass
        // so the app's muted-text floor is text-base-100/55 (5.05+ on every
        // surface up to base-800). /20 remains only on purely decorative glyphs
        // (exempt from 1.4.3).
        base: {
          50: "#f6f8fb",
          100: "#e5e7eb",
          200: "#c7cbd4",
          300: "#a5abba",
          950: "#08090c",
          900: "#0c0e13",
          850: "#11141b",
          800: "#171b24",
          700: "#232834",
          600: "#333a49",
        },
        // Primary accent — emerald, signalling on-chain value.
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        // Keyboard focus ring — emerald-300, ~13:1 against base-950 (WCAG 1.4.11 needs 3:1).
        focus: "#6ee7b7",
        // Secondary — amber, used for valuation / premium emphasis.
        gold: {
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
