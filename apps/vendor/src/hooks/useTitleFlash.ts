"use client";
import { useEffect } from "react";

/** Sets the tab title; when `alert` is set, alternates between it and the base title every second. */
export function useTitleFlash(alert: string | null, base: string) {
  useEffect(() => {
    document.title = base;
    if (!alert) return;
    let on = true;
    document.title = alert;
    const t = setInterval(() => {
      on = !on;
      document.title = on ? alert : base;
    }, 1000);
    return () => {
      clearInterval(t);
      document.title = base;
    };
  }, [alert, base]);
}
