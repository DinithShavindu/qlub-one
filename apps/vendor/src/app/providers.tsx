"use client";
import { useState, type ReactNode } from "react";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiClientError, ToastProvider } from "@one/ui";
import { PrefsProvider } from "@/lib/prefs";
import { readStorage, STORAGE_KEYS } from "@/lib/storage";

/** Any 401 from a session-scoped call means the 12h session ended → back to login. */
function onAuthError(err: unknown) {
  if (!(err instanceof ApiClientError) || err.status !== 401) return;
  if (typeof window === "undefined" || window.location.pathname.startsWith("/login")) return;
  const code = readStorage(STORAGE_KEYS.venueCode);
  window.location.replace(code ? `/login?venue=${encodeURIComponent(code)}` : "/login");
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: onAuthError }),
        mutationCache: new MutationCache({ onError: onAuthError }),
        defaultOptions: {
          queries: {
            retry: (count, err) => !(err instanceof ApiClientError && err.status > 0 && err.status < 500) && count < 2,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <PrefsProvider>
        <ToastProvider position="top">{children}</ToastProvider>
      </PrefsProvider>
    </QueryClientProvider>
  );
}
