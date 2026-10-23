import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn's class joiner: later Tailwind utilities win over earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* -------------------------------------------------------------------------- *
 * Layout the page and its loading skeleton have to agree on.
 *
 * They did not: the skeleton carried its own copy of these class strings and
 * drifted from the real page — a header that shrank to its content instead of
 * spanning the width, a hero capped 240px narrower than the card that replaces
 * it. A skeleton whose proportions are a guess is a layout shift with a shimmer
 * on it, which is the one thing it exists not to be. One definition, both
 * callers.
 * -------------------------------------------------------------------------- */

export const PAGE_SHELL =
  "mx-auto flex w-full max-w-[1320px] flex-col px-3 pb-20 pt-4 sm:px-4 md:px-10 md:pb-24 md:pt-5 lg:px-14";

export const HEADER_BAR =
  "kraft mb-8 flex w-full flex-wrap items-center gap-x-5 gap-y-2.5 rounded-[3px] px-4 py-3 shadow-lift md:mb-9 md:px-5";

export const TOOLBAR_BAR =
  "kraft mb-4 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[3px] px-3.5 py-2.5 shadow-lift md:mb-5 md:px-5";

export const CARD_GRID = "grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3";
