import type { Metadata } from "next";
import type { ReactNode } from "react";
import { fontVariables } from "@one/ui/fonts";
import "@one/ui/styles.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "qlub Ops — One Venue, One Setup",
  description: "Onboard and run a multi-vendor food court as one venue.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-screen bg-paper font-sans text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
