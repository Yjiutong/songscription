"use client";

import type { ActiveNotes } from "@/lib/audio";

/**
 * A real keyboard, in two states.
 *
 * At rest it is a survey: every key the piece ever touches is inked, so you can
 * see at a glance how much of the instrument you are being asked to cover. The
 * moment it plays, the survey clears and the keyboard becomes the performance —
 * only the notes actually sounding are lit, in the colour of the hand playing
 * them. Clay is the right hand, graphite the left, the same two leads the
 * drawing is pencilled in, so the two pictures teach the same thing.
 */

const WHITE_CLASSES = [0, 2, 4, 5, 7, 9, 11];
const FIRST_KEY = 21; // A0
const LAST_KEY = 108; // C8
const WHITE_KEY_COUNT = 52;
const MIDDLE_C = 60;

// 两只手的颜色取自鎏金与墨这两个令牌，而不是另抄一份十六进制值：
// 惯常担旋律的那只手是 right，用鎏金；另一只用墨。
const RIGHT = "#D9B24C"; // 鎏金——通常担旋律的那只手
const LEFT = "#241A12"; // 松烟墨
const PAPER = "#FBF6E9"; // 未被弹下的白键：宣纸本色
const RULE = "#DCCFA8"; // 键之间的界行
const SHARP = "#6B5940"; // 从没人弹过的黑键：暗，但不至于墨黑
const SHARP_USED = "#A98E5E"; // 这首曲子用到过的黑键：赭色一档

export function Keyboard({
  used,
  active,
  playing,
  className = "",
  showLandmarks = false,
}: {
  /** Every key the piece touches and the hand that plays it, for the survey. */
  used: Map<number, 0 | 1>;
  /** The notes sounding right now. */
  active: ActiveNotes;
  playing: boolean;
  className?: string;
  showLandmarks?: boolean;
}) {
  const lit = new Map(active.map((n) => [n.midi, n.hand]));

  const W = 1040;
  const H = 150;
  const whiteWidth = W / WHITE_KEY_COUNT;
  const blackWidth = whiteWidth * 0.6;
  const blackHeight = H * 0.62;

  const whites: React.ReactNode[] = [];
  const blacks: React.ReactNode[] = [];
  const marks: React.ReactNode[] = [];
  let whiteIndex = 0;

  for (let midi = FIRST_KEY; midi <= LAST_KEY; midi++) {
    const pitchClass = ((midi % 12) + 12) % 12;
    const hand = lit.get(midi);
    const sounding = hand !== undefined;
    const surveyedHand = used.get(midi);
    const surveyed = !playing && surveyedHand !== undefined;
    const side = hand ?? (surveyedHand === 1 ? "right" : surveyedHand === 0 ? "left" : undefined);
    const ink = (side ?? (midi < MIDDLE_C ? "left" : "right")) === "left" ? LEFT : RIGHT;
    const black = !WHITE_CLASSES.includes(pitchClass);

    if (!black) {
      const x = whiteIndex * whiteWidth;
      whites.push(
        <rect
          key={midi}
          x={x}
          y={0}
          width={whiteWidth}
          height={H}
          rx={1.5}
          fill={sounding ? ink : surveyed ? ink : PAPER}
          fillOpacity={sounding ? 1 : surveyed ? 0.5 : 1}
          stroke={RULE}
          strokeWidth={1}
          style={
            sounding
              ? { filter: `drop-shadow(0 0 7px ${ink}aa)`, transition: "none" }
              : { transition: "fill-opacity 140ms linear" }
          }
        />,
      );
      if (showLandmarks && midi === MIDDLE_C) {
        // Pencilled in the margin under the keyboard, the way you would mark
        // your own: nothing is ever drawn on top of it there.
        marks.push(
          <rect
            key="c"
            x={x + 0.5}
            y={H - 9}
            width={whiteWidth - 1}
            height={7}
            rx={2}
            fill={LEFT}
          />,
        );
      }
      whiteIndex++;
    } else {
      blacks.push(
        <rect
          key={midi}
          x={whiteIndex * whiteWidth - blackWidth / 2}
          y={0}
          width={blackWidth}
          height={blackHeight}
          rx={1.5}
          fill={sounding ? ink : surveyed ? SHARP_USED : SHARP}
          stroke={LEFT}
          strokeWidth={1}
          style={sounding ? { filter: `drop-shadow(0 0 7px ${ink}aa)` } : undefined}
        />,
      );
    }
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label={
        playing
          ? "The piano playing this piece. Keys light in clay for the right hand and graphite for the left."
          : "A full piano keyboard with every key this piece touches inked in. Right hand clay, left hand graphite."
      }
    >
      {whites}
      {blacks}
      {marks}
    </svg>
  );
}
