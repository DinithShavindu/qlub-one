import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  return (
    <div role="status" className="flex items-center gap-3 bg-status-failed px-4 py-3 text-body font-semibold text-status-failed-fg">
      <WifiOff className="h-5 w-5 shrink-0" aria-hidden />
      Offline — orders will appear when connection returns
    </div>
  );
}
