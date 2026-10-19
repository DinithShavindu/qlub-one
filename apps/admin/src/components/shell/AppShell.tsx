"use client";
import { Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ApiClientError, ErrorState } from "@one/ui";
import { useMe } from "@/lib/queries";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

function ShellInner({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const me = useMe();
  // print sheet renders without chrome
  if (params.get("print") === "1") return <>{children}</>;
  if (me.isError && !(me.error instanceof ApiClientError && me.error.status === 401)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <ErrorState title="Can't reach the qlub API" body={me.error.message} retry={() => void me.refetch()} />
      </div>
    );
  }
  if (me.isPending || me.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-muted" role="status">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        {me.isError ? "Taking you to sign in…" : "Loading…"}
      </div>
    );
  }
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="mx-auto w-full max-w-admin flex-1 px-10 py-8">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ShellInner>{children}</ShellInner>
    </Suspense>
  );
}
