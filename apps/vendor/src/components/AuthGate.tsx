"use client";
import type { ReactNode } from "react";
import type { VendorMeResponse } from "@one/contracts";
import { ApiClientError, ErrorState, Skeleton } from "@one/ui";
import { useMe } from "@/lib/queries";

/** Renders children only with a vendor session. 401 → redirect to /login (handled by the QueryCache). */
export function AuthGate({ children }: { children: (me: VendorMeResponse) => ReactNode }) {
  const me = useMe();
  if (me.data) return <>{children(me.data)}</>;
  if (me.isError && !(me.error instanceof ApiClientError && me.error.status === 401)) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-4">
        <ErrorState title="Couldn't reach the kitchen server" retry={() => void me.refetch()} />
      </main>
    );
  }
  return (
    <main className="flex min-h-dvh flex-col" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-16 rounded-none" />
      <div className="grid flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
        ))}
      </div>
    </main>
  );
}
