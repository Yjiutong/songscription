import { Skeleton } from "@/components/ui/skeleton";
import { CARD_GRID, HEADER_BAR, PAGE_SHELL, TOOLBAR_BAR } from "@/lib/utils";

/**
 * What the page looks like a moment before it arrives.
 *
 * These are not generic grey boxes: each one is the real page with nothing
 * written on it yet, at the real measurements, so nothing moves when the
 * content lands. A skeleton whose proportions are a guess is a layout shift
 * with a shimmer on it.
 */

export function CardSkeleton() {
  return (
    <article className="sheet flex flex-col">
      <div className="squared rounded-t-[3px] border-b border-rule px-4 py-4">
        <Skeleton className="h-24 w-full bg-rule/30" />
      </div>
      <div className="px-4 pb-3 pt-3.5">
        <Skeleton className="h-[19px] w-3/5" />
        <Skeleton className="mt-2 h-[13px] w-2/5" />
      </div>
      <div className="mt-auto px-4 pb-4 pt-1">
        <Skeleton className="h-[13px] w-4/5" />
        <div className="mt-3 flex items-center gap-3">
          <Skeleton className="h-[52px] w-[124px] rounded-[5px]" />
          <Skeleton className="ml-auto h-[13px] w-16" />
        </div>
      </div>
    </article>
  );
}

export function HeroSkeleton() {
  return (
    <article className="sheet sheet-raised">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4 px-4 pb-4 pt-5 md:gap-y-5 md:px-8 md:pb-5 md:pt-6">
        <div className="min-w-0 flex-1">
          {/* the eyebrow the real card leads with, which this was missing */}
          <Skeleton className="mb-2 h-[13px] w-44" />
          <Skeleton className="h-[52px] w-[min(26rem,70%)]" />
          <Skeleton className="mt-2 h-[15px] w-32" />
          <Skeleton className="mt-2.5 h-[15px] w-64" />
        </div>
        <div className="flex w-full items-center gap-2 md:w-auto md:gap-3">
          <Skeleton className="h-11 w-11 shrink-0 rounded-[5px]" />
          <Skeleton className="h-[52px] min-w-0 flex-1 rounded-[5px] md:w-[150px] md:flex-none" />
          <Skeleton className="h-[52px] min-w-0 flex-1 rounded-[5px] md:w-[150px] md:flex-none" />
        </div>
      </div>
      <div className="squared border-y border-rule px-4 py-3.5 md:px-8 md:py-4">
        <Skeleton className="h-20 w-full bg-rule/30 md:h-24" />
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-2 md:px-8 md:py-2.5">
        <Skeleton className="h-[13px] w-40" />
        <Skeleton className="h-[13px] w-24" />
      </div>
    </article>
  );
}

/** The whole catalogue, one beat before it exists. */
function ShelfSkeleton() {
  return (
    <div className="sheet flex flex-col">
      <div className="px-4 pb-2 pt-3.5">
        <Skeleton className="h-[13px] w-28" />
        <Skeleton className="mt-1.5 h-[23px] w-4/5" />
        <Skeleton className="mt-1.5 h-[14px] w-2/5" />
        <Skeleton className="mt-2 h-[3.1em] w-full" />
      </div>
      <div className="squared mx-4 mt-2.5 rounded-[2px] border border-rule px-2 py-1.5">
        <Skeleton className="h-10 w-full bg-rule/30" />
      </div>
      <div className="mt-auto flex items-center gap-3 px-4 pb-4 pt-3">
        <Skeleton className="h-10 w-[7rem] rounded-[5px]" />
        <Skeleton className="ml-auto h-[13px] w-20" />
      </div>
    </div>
  );
}

export function LibrarySkeleton() {
  return (
    <div className="board min-h-screen">
      <div className={PAGE_SHELL}>
        <header className={HEADER_BAR}>
          <Skeleton className="h-[19px] w-40 bg-graphite/15" />
          <Skeleton className="h-10 w-full rounded-[5px] bg-graphite/15 sm:ml-auto sm:max-w-[26rem] sm:flex-1" />
        </header>

        <section className="mb-14">
          <HeroSkeleton />
        </section>

        {/* The shelf is a bet on the common case: a returning reader with a
            library, which is who is usually waiting for this page. */}
        <section className="mb-14">
          {/* kraft, not graphite: this one sits on the dark board rather than
              inside a tan bar, and the label it becomes is a kraft one. */}
          <Skeleton className="mb-4 h-[34px] w-[13rem] rounded-[3px] bg-kraft/60" />
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <ShelfSkeleton key={i} />
            ))}
          </div>
        </section>

        <section>
          <div className={TOOLBAR_BAR}>
            <Skeleton className="h-[17px] w-40 bg-graphite/15" />
            <div className="flex w-full flex-wrap items-center gap-2.5 sm:ml-auto sm:w-auto sm:flex-nowrap">
              <Skeleton className="h-10 w-[7.5rem] rounded-[5px] bg-graphite/15" />
              <Skeleton className="h-10 w-[7rem] rounded-[5px] bg-graphite/15" />
              <Skeleton className="h-10 w-[calc(50%-0.3125rem)] rounded-[5px] bg-graphite/15 sm:w-[11rem]" />
              <Skeleton className="h-10 w-[calc(50%-0.3125rem)] rounded-[5px] bg-graphite/15 sm:w-[13rem]" />
            </div>
          </div>
          <div className={CARD_GRID}>
            {Array.from({ length: 6 }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
