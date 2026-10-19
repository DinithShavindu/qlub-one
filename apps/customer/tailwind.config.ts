import type { Config } from "tailwindcss";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const preset = require("@one/ui/tailwind-preset");

const config: Config = {
  presets: [preset],
  // Inter for headings too (qlub look)
  theme: { extend: { fontFamily: { display: ["var(--font-text)", "ui-sans-serif", "system-ui", "sans-serif"] } } },
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
};
export default config;
