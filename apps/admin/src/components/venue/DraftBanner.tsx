import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ButtonLink";

export function DraftBanner({ venueId }: { venueId: string }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-brand/40 bg-surface px-5 py-3">
      <p className="text-small text-ink-soft">
        <span className="font-semibold text-ink">This venue is still a draft.</span> Guests can&apos;t order until it goes live.
      </p>
      <ButtonLink href={`/venues/new?id=${venueId}`} size="sm">
        Continue setup <ArrowRight className="h-4 w-4" aria-hidden />
      </ButtonLink>
    </div>
  );
}
