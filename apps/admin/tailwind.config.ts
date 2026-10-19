import type { Config } from "tailwindcss";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const preset = require("@one/ui/tailwind-preset");

const config: Config = {
  presets: [preset],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // qlub admin rail
        rail: { DEFAULT: "#161A2B", hover: "#22273A", active: "#2A3047", fg: "#C9CDD6" },
      },
      // admin uses one text face for headings too, like the qlub admin panel
      fontFamily: { display: ["var(--font-text)", "ui-sans-serif", "system-ui", "sans-serif"] },
      maxWidth: { admin: "1600px" },
    },
  },
};
export default config;
