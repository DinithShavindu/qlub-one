import { DM_Sans, Space_Grotesk } from "next/font/google";

export const displayFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
  display: "swap",
});

export const textFont = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-text",
  display: "swap",
});

/** Put on <html>: `className={fontVariables}` */
export const fontVariables = `${displayFont.variable} ${textFont.variable}`;
