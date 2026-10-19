import "@one/ui/styles.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { fontVariables } from "@one/ui/fonts";
import { Providers } from "./providers";

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
    <html lang="en" className={fontVariables}>
      <body className="min-h-dvh bg-paper text-ink">
        <Providers>
          <div className="mx-auto min-h-dvh w-full max-w-customer bg-paper">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
