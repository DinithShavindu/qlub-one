"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { cn } from "../utils";

export function ErrorState({
  title = "Something went wrong",
  body = "Check your connection and try again.",
  retry,
  className,
}: {
  title?: string;
  body?: string;
  retry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      <AlertTriangle className="h-8 w-8 text-status-failed-fg" aria-hidden />
      <p className="text-body font-semibold">{title}</p>
      <p className="max-w-sm text-small text-ink-muted">{body}</p>
      {retry && (
        <Button variant="secondary" className="mt-3" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
