import "@one/ui/styles.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { fontVariables } from "@one/ui/fonts";
import { THEME_INIT_SCRIPT } from "@/lib/prefs";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Vendor panel — qlub One",
  description: "Vendor panel: dashboard, orders, payments, tables, QSR orders, menu and reports",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // light by default; the inline script flips to dark before paint if the user chose it
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-paper text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
