"use client";
import { useEffect, useState } from "react";

/** Current time (ms), re-rendering every `intervalMs`. Used for live clocks, age timers and undo windows. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
