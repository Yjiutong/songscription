"use client";

import * as React from "react";
import type { Note } from "@/lib/audio";

/**
 * The whole piece at once, and a playhead you can move.
 *
 * Everything fits the width: no scrolling, no window into the music, so the
 * shape of the piece from first note to last is one picture you can take in.
 * Click anywhere on it and playback moves there, whether or not it was already
 * running; the arrow keys step five seconds.
 *
 * The notes and the playhead are deliberately separate layers. The playhead
 * moves every animation frame, and a busy piece is several thousand rects —
 * redrawing those sixty times a second to move one line is how a page like this
 * starts dropping frames.
 */

const PAD_SEMITONES = 2;
const SPAN = 1000; // the drawing's own horizontal units
const RIGHT = "#D9B24C"; // 鎏金——通常担旋律的那只手
const LEFT = "#241A12"; // 松烟墨

export function Roll({
  notes,
  duration,
  position,
  onSeek,
  className = "",
}: {
  notes: Note[];
  duration: number;
  position: number;
  onSeek: (seconds: number) => void;
  className?: string;
}) {
  const box = React.useRef<HTMLDivElement>(null);

  const range = React.useMemo(() => {
    let lo = 127;
    let hi = 0;
    for (const n of notes) {
      if (n.midi < lo) lo = n.midi;
      if (n.midi > hi) hi = n.midi;
    }
    if (lo > hi) return { lowest: 48, highest: 72 };
    return { lowest: lo - PAD_SEMITONES, highest: hi + PAD_SEMITONES };
  }, [notes]);

  const progress = duration > 0 ? Math.max(0, Math.min(position / duration, 1)) : 0;

  function seekFromEvent(e: React.MouseEvent<HTMLDivElement>) {
    const el = box.current;
    if (!el || duration <= 0) return;
    const rect = el.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(fraction, 1)) * duration);
  }

  return (
    <div
      ref={box}
      onClick={seekFromEvent}
      role="slider"
      tabIndex={0}
      aria-label="整首曲子，从左到右。点一下就从那里弹。"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(position)}
      aria-valuetext={`${clock(position)} of ${clock(duration)}`}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        onSeek(Math.max(0, Math.min(position + (e.key === "ArrowRight" ? 5 : -5), duration)));
      }}
      className={`squared relative cursor-pointer overflow-hidden rounded-[2px] border border-rule focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kraft-deep ${className}`}
    >
      <Notes notes={notes} duration={duration} {...range} />

      {/* Where you are. A line, and a head big enough to aim at. */}
      <div
        className="pointer-events-none absolute inset-y-0 w-[2px] bg-kraft-deep"
        style={{ left: `${progress * 100}%` }}
      >
        <span className="absolute -left-[5px] top-0 block h-3 w-3 rounded-full bg-kraft-deep" />
      </div>
    </div>
  );
}

/**
 * The notes themselves, drawn once.
 *
 * Memoised on the piece rather than on playback, so moving the playhead never
 * touches this layer.
 */
const Notes = React.memo(function Notes({
  notes,
  duration,
  lowest,
  highest,
}: {
  notes: Note[];
  duration: number;
  lowest: number;
  highest: number;
}) {
  const height = highest - lowest + 1;
  const scale = duration > 0 ? SPAN / duration : 0;

  // A mark each half minute, so a long piece has somewhere to aim for.
  const marks: number[] = [];
  if (duration > 45) {
    for (let t = 30; t < duration; t += 30) marks.push(t);
  }

  return (
    <svg
      viewBox={`0 0 ${SPAN} ${height}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      {marks.map((t) => (
        <line
          key={t}
          x1={t * scale}
          x2={t * scale}
          y1={0}
          y2={height}
          stroke="#DCCFA8"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <g fill={LEFT} opacity={0.9}>
        {notes
          .filter((n) => n.hand === 0)
          .map((n, i) => (
            <rect
              key={i}
              x={n.time * scale}
              y={highest - n.midi}
              width={Math.max(n.duration * scale, 1.2)}
              height={0.86}
              rx={0.4}
            />
          ))}
      </g>
      <g fill={RIGHT}>
        {notes
          .filter((n) => n.hand === 1)
          .map((n, i) => (
            <rect
              key={i}
              x={n.time * scale}
              y={highest - n.midi}
              width={Math.max(n.duration * scale, 1.2)}
              height={0.86}
              rx={0.4}
            />
          ))}
      </g>
    </svg>
  );
});

export function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
