import { Skeleton } from "@one/ui";

/** 3 vendor sections × 3 rows, matching the final layout. */
export function MenuSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading menu">
      <div className="flex h-14 items-center gap-3 border-b border-line px-4">
        <Skeleton className="h-6 flex-1" />
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-9 w-9" />
      </div>
      <div className="flex gap-2 border-b border-line px-4 py-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-11 w-32 shrink-0 rounded-full" />
        ))}
      </div>
      {[0, 1, 2].map((s) => (
        <div key={s} className="px-4 pt-6">
          <Skeleton className="h-8 w-48" />
          {[0, 1, 2].map((r) => (
            <div key={r} className="flex items-start gap-3 py-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-11 w-11 rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
