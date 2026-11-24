"use client";

/**
 * OpenStore — shared skeleton loader for data tables.
 *
 * Renders a realistic loading placeholder: a header row + N body rows of
 * shimmering bars, mirroring the real table layout so the page doesn't jump
 * when data arrives. Used by every admin section that shows a data table
 * (inventory, stock-in, losses, expenses, cashiers) while its query is in
 * flight — a "complete" skeleton experience across the UI.
 */
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function TableSkeleton({
  /** Number of body rows to render. */
  rows = 5,
  /** Number of columns. */
  columns = 5,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-2 overflow-hidden rounded-md border border-border/60 p-3",
        className,
      )}
      aria-busy="true"
      aria-label="Loading data"
    >
      {/* Header row */}
      <div className="flex items-center gap-4 border-b border-border/60 pb-2">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`h${i}`} className="h-3.5 flex-1" />
        ))}
      </div>
      {/* Body rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 py-1">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={`${r}-${c}`}
              className={cn(
                "h-4 flex-1",
                // vary widths slightly per column for a natural look
                c === 0 && "max-w-[5rem]",
                c === columns - 1 && "max-w-[3rem]",
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
