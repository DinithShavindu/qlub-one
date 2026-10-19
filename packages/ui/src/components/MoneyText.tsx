import { formatMoney } from "@one/contracts";
import { cn } from "../utils";

export function MoneyText({ minor, currency, className }: { minor: number; currency: string; className?: string }) {
  return <span className={cn("tabular-nums", className)}>{formatMoney(minor, currency)}</span>;
}
