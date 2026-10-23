"use client";

import * as React from "react";
import { Check, Loader2, Piano, Play, Square, Star } from "lucide-react";
import { FrameButton } from "@/components/ui/frame-button";
import { cn } from "@/lib/utils";
import {
  play as audioPlay,
  stop as audioStop,
  seek as audioSeek,
  nowPlaying as audioNowPlaying,
  type ActiveNotes,
} from "@/lib/audio";

/**
 * 难度计，界行上的五个方块。
 *
 * 色阶是一条调色律：宣纸暖白、界行、明金、鎏金深处、松烟墨。它从界行自己
 * 的颜色一路走到案面的墨色，于是一整个书架的难易高下，在读到任何一个字
 * 之前就已经先声夺人——曲子没能达到的那几格，画的是空格而不是熄灭；旁边
 * 永远跟着一个词，颜色从不单独承载这件事。
 */
const RAMP = ["#EFE3C4", "#DCCFA8", "#C9A227", "#8F6620", "#241A12"];

export function LevelMarks({
  level,
  onBoard = false,
  className = "",
}: {
  level: number;
  onBoard?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-[3px] ${className}`} aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="h-[11px] w-[11px] rounded-[1.5px]"
          style={
            i <= level
              ? { background: RAMP[i - 1], boxShadow: "inset 0 0 0 1px rgba(42,24,14,0.62)" }
              : {
                  boxShadow: `inset 0 0 0 1px ${
                    onBoard ? "rgba(220,207,168,0.45)" : "rgba(87,70,54,0.45)"
                  }`,
                }
          }
        />
      ))}
    </span>
  );
}

/**
 * A reading, counted off in squares on the ruling.
 *
 * The page already has a unit — the 24px lattice everything else sits on — so a
 * measurement here is squares filled out of ten, the way you would tally one in
 * the margin. It is the same device as the difficulty marks at a different
 * length, which is why the sheet needs no second chart language.
 */
export function Meter({ value, className = "" }: { value: number; className?: string }) {
  const filled = Math.max(1, Math.min(10, Math.round(value * 10)));
  return (
    <span className={`inline-flex items-center gap-[3px] ${className}`} aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className="h-[9px] w-[9px] rounded-[1.5px]"
          style={
            i < filled
              ? { background: "#D9B24C", boxShadow: "inset 0 0 0 1px rgba(42,24,14,0.5)" }
              : { boxShadow: "inset 0 0 0 1px rgba(87,70,54,0.45)" }
          }
        />
      ))}
    </span>
  );
}

/**
 * The star you put beside a piece you love.
 *
 * Hollow when the page is ordinary, filled in clay when it is one of yours. It
 * is a real toggle with a pressed state, a busy state while the change is
 * saving, and a label that says which way it will go.
 */
export function FavouriteButton({
  favourite,
  title,
  onToggle,
  className = "",
}: {
  favourite: boolean;
  title: string;
  onToggle: () => void | Promise<void>;
  className?: string;
}) {
  const [busy, setBusy] = React.useState(false);

  return (
    <button
      type="button"
      aria-pressed={favourite}
      aria-busy={busy}
      disabled={busy}
      title={favourite ? "已收藏" : "加入收藏"}
      aria-label={
        favourite ? `把《${title}》从收藏里拿掉` : `把《${title}》加进收藏`
      }
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        try {
          await onToggle();
        } finally {
          setBusy(false);
        }
      }}
      className={cn(
        "group/fav inline-flex h-9 w-9 items-center justify-center rounded-[5px] border transition-[background-color,border-color,transform,opacity] duration-150 active:translate-y-px disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kraft-deep",
        favourite
          ? "border-kraft-deep/45 bg-kraft/35 text-kraft-deep hover:bg-kraft/55"
          : "border-transparent text-graphite-soft hover:border-rule hover:bg-paper-warm hover:text-kraft-deep",
        className,
      )}
    >
      <Star
        className={`h-[19px] w-[19px] transition-transform duration-200 group-hover/fav:scale-110 group-active/fav:scale-95 ${
          busy ? "animate-pulse" : ""
        }`}
        strokeWidth={1.75}
        fill={favourite ? "currentColor" : "none"}
      />
    </button>
  );
}

/* -------------------------------------------------------------------------- *
 * Hear it.
 *
 * A beginner cannot read a MIDI picture, so hearing the piece is the only way
 * they can judge it. This is the primary act of the page and it is sized like
 * one, in the only fully saturated colour the page owns, inside the crop marks
 * that mark out a page on a printed sheet.
 *
 * The playing itself lives in a hook rather than in the button, because the
 * sheet needs the same playback the button starts: its roll has to follow the
 * playhead and move it. One owner, two controls.
 * -------------------------------------------------------------------------- */

export type PlayState = "idle" | "loading" | "playing";

export function usePlayback(id: string, source: string) {
  const [state, setState] = React.useState<PlayState>("idle");
  const [active, setActive] = React.useState<ActiveNotes>([]);
  const [transport, setTransport] = React.useState({ position: 0, duration: 0 });

  React.useEffect(
    () => () => {
      if (audioNowPlaying() === id) audioStop();
    },
    [id],
  );

  const start = React.useCallback(
    async (from: number) => {
      setState("loading");
      await audioPlay(
        id,
        source,
        {
          onEnd: () => {
            setState("idle");
            setActive([]);
          },
          onActive: setActive,
          onTime: setTransport,
        },
        from,
      );
      setState(audioNowPlaying() === id ? "playing" : "idle");
    },
    [id, source],
  );

  const toggle = React.useCallback(() => {
    if (state === "idle") {
      void start(0);
      return;
    }
    audioStop();
    setState("idle");
    setActive([]);
  }, [state, start]);

  // Pointing at a moment means play from there, whether or not it is running.
  const seekTo = React.useCallback(
    (seconds: number) => {
      if (audioNowPlaying() === id) {
        audioSeek(seconds);
        setTransport((t) => ({ ...t, position: seconds }));
        return;
      }
      void start(seconds);
    },
    [id, start],
  );

  return { state, active, transport, toggle, seekTo };
}

/** The key itself, told what to show. */

/**
 * The act the whole catalogue exists to lead to.
 *
 * It takes the clay key and the biggest size on every surface it appears on,
 * and playback steps down to paper beside it. Hearing a piece is how you judge
 * it; sitting down and practising it is the point, and the page should not make
 * you hunt for the verb it is named after.
 */
export function PractiseButton({
  title,
  onPractise,
  busy = false,
  done = false,
  size = "small",
  compact = false,
  className = "",
}: {
  title: string;
  onPractise: () => void | Promise<void>;
  busy?: boolean;
  done?: boolean;
  /** `hero` is the desk card, where this is the largest thing on the page. */
  size?: "small" | "large" | "hero";
  compact?: boolean;
  className?: string;
}) {
  const hero = size === "hero";
  const large = hero || size === "large";

  return (
    <FrameButton
      type="button"
      variant="clay"
      size={hero ? 19 : large ? 17 : 13}
      offset={hero ? 8 : large ? 7 : 5}
      className={`${hero ? "h-[72px] px-8 text-[18px] tracking-[0.06em]" : large ? "h-[60px] px-7 text-[16px]" : "h-11 text-[13px]"} ${
        large ? "" : compact ? "px-3 sm:px-4" : "px-4"
      } gap-2.5 ${className}`}
      aria-label={done ? `《${title}》已记一次练习` : `练《${title}》`}
      disabled={busy}
      onClick={(e) => {
        // The card behind this is a link to the song's page; practising is not
        // the same act as opening it.
        e.stopPropagation();
        void onPractise();
      }}
    >
      {busy ? (
        <Loader2 className={large ? "h-[21px] w-[21px] animate-spin" : "h-4 w-4 animate-spin"} />
      ) : done ? (
        <Check className={large ? "h-[21px] w-[21px]" : "h-4 w-4"} strokeWidth={2.25} />
      ) : (
        <Piano className={large ? "h-[21px] w-[21px]" : "h-4 w-4"} strokeWidth={1.9} />
      )}
      <span className={compact ? "sr-only sm:not-sr-only" : undefined}>
        {done ? "已记下" : "练了这一遍"}
      </span>
    </FrameButton>
  );
}

export function PlayControl({
  state,
  title,
  onToggle,
  size = "small",
  compact = false,
  iconOnly = false,
  className = "",
}: {
  state: PlayState;
  title: string;
  onToggle: () => void;
  size?: "small" | "large";
  compact?: boolean;
  /** Icon alone. On a card where Practise leads, the word is the loser of the
   *  two and wrapping "PLAY / IT" onto two lines is worse than dropping it. */
  iconOnly?: boolean;
  className?: string;
}) {
  const large = size === "large";
  const busy = state === "loading";
  const playing = state === "playing";

  return (
    <FrameButton
      type="button"
      variant="paper"
      size={large ? 15 : 13}
      offset={large ? 6 : 5}
      className={`${large ? "h-12 px-6 text-[14px]" : "h-11 text-[13px]"} ${
        large ? "" : iconOnly ? "w-11 px-0" : compact ? "px-3 sm:px-4" : "px-4"
      } gap-2.5 ${className}`}
      aria-label={playing ? `Stop ${title}` : `Play ${title}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      {busy ? (
        <Loader2 className={large ? "h-[17px] w-[17px] animate-spin" : "h-4 w-4 animate-spin"} />
      ) : playing ? (
        <Square
          className={large ? "h-[15px] w-[15px] fill-current" : "h-[13px] w-[13px] fill-current"}
          strokeWidth={0}
        />
      ) : (
        <Play
          className={large ? "h-[17px] w-[17px] fill-current" : "h-4 w-4 fill-current"}
          strokeWidth={0}
        />
      )}
      <span className={iconOnly ? "sr-only" : compact ? "sr-only sm:not-sr-only" : undefined}>
        {playing ? "停下" : busy ? "正在准备" : "播放"}
      </span>
    </FrameButton>
  );
}

/** A key that owns its own playback, for a card or a row. */
export function PlayButton({
  id,
  source,
  title,
  size = "small",
  className = "",
  compact = false,
  iconOnly = false,
}: {
  id: string;
  source: string;
  title: string;
  size?: "small" | "large";
  className?: string;
  compact?: boolean;
  iconOnly?: boolean;
}) {
  const playback = usePlayback(id, source);
  return (
    <PlayControl
      state={playback.state}
      title={title}
      onToggle={playback.toggle}
      size={size}
      compact={compact}
      iconOnly={iconOnly}
      className={className}
    />
  );
}
