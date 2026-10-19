"use client";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@one/ui";
import { readStorage, STORAGE_KEYS } from "@/lib/storage";

export function useLogout() {
  const router = useRouter();
  const qc = useQueryClient();
  return useCallback(async () => {
    await apiFetch("/v1/vendor/logout", { method: "POST" }).catch(() => undefined);
    qc.clear();
    const code = readStorage(STORAGE_KEYS.venueCode);
    router.replace(code ? `/login?venue=${encodeURIComponent(code)}` : "/login");
  }, [qc, router]);
}
