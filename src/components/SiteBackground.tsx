"use client";

import { ShaderBackground } from "@/components/ui/shader-background";
import { useAppearance } from "@/lib/appearance";

/**
 * The page's ground, behind everything.
 *
 * Nobody has chosen a picture: it is the slow shader in the board's own range,
 * so the cover has the depth of a real pressed board — and because every paper
 * object on the page carries its own shadow, the moving ground reads as the
 * thing the pages are lying on rather than as decoration behind them.
 *
 * Somebody has chosen a picture: theirs is the ground now, and everything above
 * it learns to live with it.
 */
export function SiteBackground() {
  const { image } = useAppearance();

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {image ? (
        <>
          {/* `object-cover` rather than contain: a photo with letterboxing on it
              reads as a photo the app failed to fit, which it did not. */}
          <img src={image} alt="" className="h-full w-full object-cover" />
          {/* A picture is not a background until something has been done to its
              contrast — text crossing a bright sky is unreadable without this. */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/5 to-black/35" />
          <div className="absolute inset-0 bg-board/10" />
        </>
      ) : (
        <>
          <ShaderBackground className="absolute inset-0 h-full w-full" />
          {/* The scrim is the book's own board colour, not black: it steadies the
              contrast under the paper without turning the page grey. */}
          <div className="absolute inset-0 bg-gradient-to-b from-board/20 via-transparent to-board/40" />
        </>
      )}
    </div>
  );
}
