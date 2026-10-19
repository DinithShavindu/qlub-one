/** Design tokens from docs/DESIGN_SYSTEM.md. Apps use these names, never raw hex. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: v("ink"), soft: v("ink-soft"), muted: v("ink-muted") },
        paper: v("paper"),
        surface: { DEFAULT: v("surface"), sunk: v("surface-sunk") },
        line: v("line"),
        brand: { DEFAULT: v("brand"), strong: v("brand-strong") },
        "on-brand": v("on-brand"),
        "status-new": { DEFAULT: v("status-new"), fg: v("status-new-fg") },
        "status-prep": { DEFAULT: v("status-prep"), fg: v("status-prep-fg") },
        "status-ready": { DEFAULT: v("status-ready"), fg: v("status-ready-fg") },
        "status-done": { DEFAULT: v("status-done"), fg: v("status-done-fg") },
        "status-failed": { DEFAULT: v("status-failed"), fg: v("status-failed-fg") },
        "vendor-1": v("vendor-1"),
        "vendor-2": v("vendor-2"),
        "vendor-3": v("vendor-3"),
        "vendor-4": v("vendor-4"),
        "vendor-5": v("vendor-5"),
        "vendor-6": v("vendor-6"),
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-text)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        display: ["40px", { lineHeight: "44px" }],
        "display-kds": ["56px", { lineHeight: "60px" }],
        h1: ["28px", { lineHeight: "34px" }],
        h2: ["22px", { lineHeight: "28px" }],
        body: ["16px", { lineHeight: "24px" }],
        small: ["14px", { lineHeight: "20px" }],
        micro: ["12px", { lineHeight: "16px", letterSpacing: "0.04em" }],
      },
      borderRadius: { sm: "8px", md: "12px", lg: "16px", xl: "24px" },
      boxShadow: {
        card: "0 1px 2px rgba(18,22,31,.06), 0 4px 12px rgba(18,22,31,.06)",
        sheet: "0 1px 2px rgba(18,22,31,.06), 0 4px 12px rgba(18,22,31,.06), 0 -8px 24px rgba(18,22,31,.12)",
      },
      maxWidth: { customer: "480px", admin: "1200px" },
      transitionDuration: { DEFAULT: "150ms", sheet: "220ms" },
      transitionTimingFunction: { DEFAULT: "cubic-bezier(0, 0, 0.2, 1)" },
      keyframes: {
        "ready-pop": { "0%, 100%": { transform: "scale(1)" }, "50%": { transform: "scale(1.03)" } },
        "slide-in-top": { from: { transform: "translateY(-16px)", opacity: "0" }, to: { transform: "translateY(0)", opacity: "1" } },
        "slide-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        "pulse-border": { "0%, 100%": { boxShadow: "0 0 0 0 rgb(var(--brand) / 0.0)" }, "50%": { boxShadow: "0 0 0 4px rgb(var(--brand) / 0.9)" } },
        shake: { "0%, 100%": { transform: "translateX(0)" }, "20%, 60%": { transform: "translateX(-8px)" }, "40%, 80%": { transform: "translateX(8px)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        "ready-pop": "ready-pop 400ms ease-out 1",
        "slide-in-top": "slide-in-top 220ms ease-out",
        "slide-up": "slide-up 220ms ease-out",
        "pulse-border": "pulse-border 1.2s ease-in-out infinite",
        shake: "shake 360ms ease-in-out",
        "fade-in": "fade-in 150ms ease-out",
      },
    },
  },
  plugins: [],
};
