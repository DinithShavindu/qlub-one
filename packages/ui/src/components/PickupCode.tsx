import { cn } from "../utils";

export function PickupCode({ code, size = "md", className }: { code: string; size?: "md" | "kds"; className?: string }) {
  return (
    <span
      className={cn(
        "font-display font-bold tabular-nums tracking-tight",
        size === "kds" ? "text-display-kds" : "text-display",
        className,
      )}
      aria-label={`Pickup code ${code.split("").join(" ")}`}
    >
      {code}
    </span>
  );
}
