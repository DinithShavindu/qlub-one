"use client";
import type { ReactNode } from "react";
import { AuthGate } from "@/components/AuthGate";
import { PanelShell } from "@/components/shell/PanelShell";
import { PanelProvider } from "@/lib/panel";

/** Every panel page needs a vendor or venue-manager session; the shell carries the rail + account bar. */
export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      {(me) => (
        <PanelProvider me={me}>
          <PanelShell>{children}</PanelShell>
        </PanelProvider>
      )}
    </AuthGate>
  );
}
