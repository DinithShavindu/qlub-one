import "@one/ui/styles.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { fontVariables } from "@one/ui/fonts";
import { THEME_INIT_SCRIPT } from "@/lib/prefs";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Kitchen — qlub One",
  description: "Vendor kitchen display",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // dark by default; the inline script flips to light before paint if the user chose it
    <html lang="en" className={`dark ${fontVariables}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-paper text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
