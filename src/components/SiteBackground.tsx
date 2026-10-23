"use client";

import { ShaderBackground } from "@/components/ui/shader-background";

/**
 * The page's ground, behind everything.
 *
 * The board used to be a flat olive fill with a speckle over it. It is now a
 * slow shader in the same range, so the cover has the depth of a real pressed
 * board — and because every paper object on the page carries its own shadow,
 * the moving ground reads as the thing the pages are lying on rather than as
 * decoration behind them.
 *
 * The scrim is the book's own board colour, not black: it steadies the contrast
 * under the paper without turning the page grey.
 */
export function SiteBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <ShaderBackground className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-gradient-to-b from-board/20 via-transparent to-board/40" />
    </div>
  );
}
