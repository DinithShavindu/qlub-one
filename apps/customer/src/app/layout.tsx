import "@one/ui/styles.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-text", display: "swap" });

export const metadata: Metadata = {
  title: "Order · One Venue",
  description: "Order from every stall, pay once.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="qlub-pattern min-h-dvh text-ink">
        <Providers>
          <div className="mx-auto min-h-dvh w-full max-w-customer bg-paper">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
