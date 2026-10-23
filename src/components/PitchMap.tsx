/**
 * The piece, pencilled in.
 *
 * Drawn the way you would pencil it into an exercise book: two leads, graphite
 * for the left hand and clay for the right, straight onto the squares. The
 * colour is not decoration. It is which hand plays the note, which is the one
 * thing about the shape a learner can act on.
 *
 * The hand comes from the file's own tracks wherever it has them. Rows written
 * before that was recorded fall back to the middle-C split, which is why a
 * figure that crosses middle C can still come out in two colours on them.
 */
export type MappedNote = [number, number, number, number?];

/** Middle C, the fallback divider when a file names no hands. */
const MIDDLE_C = 60;

function handOf([, midi, , hand]: MappedNote): 0 | 1 {
  if (hand === 0 || hand === 1) return hand;
  return midi >= MIDDLE_C ? 1 : 0;
}

const RIGHT = "#D9B24C"; // 鎏金——通常担旋律的那只手
const LEFT = "#241A12"; // 松烟墨

/** Past this many notes the drawing stops being a shape and becomes texture. */
const LEGIBLE_NOTES = 190;

export function PitchMap({
  notes,
  lowest,
  highest,
  className = "",
  ariaLabel,
  opening = false,
}: {
  notes: MappedNote[];
  lowest: number;
  highest: number;
  className?: string;
  ariaLabel?: string;
  /** Draw only as much of the piece as stays readable at this size. */
  opening?: boolean;
}) {
  const pad = 3;
  const span = Math.max(highest + pad - (lowest - pad), 10);
  const thickness = Math.min(2.8, Math.max(1.2, span / 22));

  // Take the opening and stretch it back over the full width, so the drawing
  // keeps its scale instead of being squeezed.
  const crowded = opening && notes.length > LEGIBLE_NOTES;
  const cut = crowded ? (1000 * LEGIBLE_NOTES) / notes.length : 1000;
  const scale = 1000 / cut;
  const drawn: MappedNote[] = crowded
    ? notes.filter(([s]) => s < cut).map(([s, m, l, h]) => [s * scale, m, l * scale, h])
    : notes;

  const bar = ([start, midi, length]: MappedNote, i: number) => (
    <rect
      key={i}
      x={start}
      y={highest + pad - midi}
      width={Math.max(length, 3.5)}
      height={thickness}
      rx={thickness / 2}
    />
  );

  return (
    <svg
      viewBox={`0 0 1000 ${span}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label={
        ariaLabel ??
        "The notes of this piece: time runs left to right, pitch runs upward. The right hand is drawn in clay and the left hand in graphite."
      }
    >
      <g fill={LEFT} opacity={0.88}>
        {drawn.filter((n) => handOf(n) === 0).map(bar)}
      </g>
      <g fill={RIGHT}>{drawn.filter((n) => handOf(n) === 1).map(bar)}</g>
    </svg>
  );
}
