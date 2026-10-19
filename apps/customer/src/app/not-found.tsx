import Link from "next/link";
import { EmptyState } from "@one/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <EmptyState
        title="This page doesn't exist"
        body="Scan the QR on your table to start an order."
        action={
          <Link href="/" className="text-small font-semibold text-brand-strong underline underline-offset-2">
            Go home
          </Link>
        }
      />
    </main>
  );
}
