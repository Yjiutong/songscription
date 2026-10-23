import { Midi } from "@tonejs/midi";

/**
 * Everything in `Analysis` is read out of the .mid file itself. Nothing here is
 * invented — that matters, because the interface tells a learner how hard a
 * piece is and it has to be able to show its working.
 */
export type Analysis = {
  title: string;
  composer: string | null;
  durationSeconds: number;
  tempoBpm: number | null;
  timeSignature: string | null;
  keySignature: string | null;
  /** true when the key was written into the file, false when we inferred it */
  keyIsEstimated: boolean;
  noteCount: number;
  lowestNote: number;
  highestNote: number;
  distinctPitchCount: number;
  maxSimultaneousNotes: number;
  notesPerSecond: number;
  blackKeyFraction: number;
  trackCount: number;
  /** two hands are involved, and why we think so */
  twoHands: boolean;
  twoHandsBasis: "separate tracks" | "notes on both sides of middle C" | "one hand";
  difficulty: 1 | 2 | 3 | 4 | 5;
  difficultyFactors: DifficultyFactor[];
  /** downsampled [startPermille, midiNote, durationPermille] for the pitch map */
  /** [start, pitch, length, hand] — hand 0 is the left, 1 the right. */
  pitchMap: [number, number, number, number][];
};

export type DifficultyFactor = {
  key: string;
  /** plain-language name — the label a non-musician reads */
  label: string;
  /** the measured value, in words */
  reading: string;
  /** 0–1, how much this pushes the difficulty up */
  weight: number;
};

const BLACK_KEY_CLASSES = new Set([1, 3, 6, 8, 10]);
const PITCH_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

// Krumhansl–Kessler key profiles, used only when the file declares no key.
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const MAX_PITCH_MAP_NOTES = 900;

export function analyseMidi(data: ArrayBuffer, filename: string): Analysis {
  const midi = new Midi(data);

  // Which hand plays a note is a fact the file usually already carries, in its
  // tracks. Splitting on middle C instead cuts straight through any figure that
  // crosses it — a Moonlight triplet came out half in one hand and half in the
  // other — so the pitch split is now only the fallback for a single-track file.
  const handOfTrack = assignHands(midi.tracks);
  const notes = midi.tracks
    .flatMap((track, index) =>
      track.notes.map((note) => Object.assign(note, { hand: handOfTrack[index] })),
    )
    .sort((a, b) => a.time - b.time);

  if (notes.length === 0) {
    throw new MidiError(
      "That file has no notes in it.",
      "It parsed as MIDI, but every track is empty, so there is nothing to practise. Try exporting it again.",
    );
  }

  const duration = Math.max(midi.duration, notes[notes.length - 1].time + notes[notes.length - 1].duration);
  const pitches = notes.map((n) => n.midi);
  const lowestNote = Math.min(...pitches);
  const highestNote = Math.max(...pitches);
  const distinctPitchCount = new Set(pitches).size;
  const blackKeyCount = pitches.filter((p) => BLACK_KEY_CLASSES.has(((p % 12) + 12) % 12)).length;
  const blackKeyFraction = blackKeyCount / notes.length;
  const maxSimultaneousNotes = maxOverlap(notes);
  const notesPerSecond = duration > 0 ? notes.length / duration : 0;

  const tracksWithNotes = midi.tracks.filter((t) => t.notes.length > 0).length;
  let twoHands: boolean;
  let twoHandsBasis: Analysis["twoHandsBasis"];
  if (tracksWithNotes >= 2) {
    twoHands = true;
    twoHandsBasis = "separate tracks";
  } else if (lowestNote < 60 && highestNote >= 60 && highestNote - lowestNote > 14) {
    twoHands = true;
    twoHandsBasis = "notes on both sides of middle C";
  } else {
    twoHands = false;
    twoHandsBasis = "one hand";
  }

  // A key-signature event can exist with no usable key on it; trusting the
  // event's presence rather than its contents printed "undefined major".
  const declared = midi.header.keySignatures[0];
  const declaredKey = declared?.key ? `${declared.key} ${declared.scale ?? "major"}` : null;
  const keySignature =
    declaredKey ?? estimateKey(notes.map((n) => ({ midi: n.midi, duration: n.duration })));

  const ts = midi.header.timeSignatures[0];
  const tempo = midi.header.tempos[0];

  const [busiestHand, quietHand] = handRates(notes, midi.tracks, duration, twoHands);

  const factors = scoreDifficulty({
    span: highestNote - lowestNote,
    busiestHand,
    quietHand,
    distinctPitchCount,
    blackKeyFraction,
  });

  const difficulty = gradeFrom(factors);

  return {
    title: titleFromFilename(filename, midi.name),
    composer: composerFromFilename(filename),
    durationSeconds: round(duration, 2),
    tempoBpm: tempo ? Math.round(tempo.bpm) : null,
    timeSignature: ts ? `${ts.timeSignature[0]}/${ts.timeSignature[1]}` : null,
    keySignature,
    keyIsEstimated: declaredKey === null,
    noteCount: notes.length,
    lowestNote,
    highestNote,
    distinctPitchCount,
    maxSimultaneousNotes,
    notesPerSecond: round(notesPerSecond, 3),
    blackKeyFraction: round(blackKeyFraction, 3),
    trackCount: tracksWithNotes,
    twoHands,
    twoHandsBasis,
    difficulty,
    difficultyFactors: factors,
    pitchMap: buildPitchMap(notes, duration, handOfTrack.length > 0),
  };
}

export class MidiError extends Error {
  detail: string;
  constructor(message: string, detail: string) {
    super(message);
    this.name = "MidiError";
    this.detail = detail;
  }
}

/* -------------------------------------------------------------------------- */

/**
 * What actually makes a piece hard for someone learning it.
 *
 * An earlier version scored the biggest chord in the piece, which rated Silent
 * Night — block triads under a slow tune — as hard as Für Elise. A left hand
 * holding a chord is easy; a left hand that has to *move* while the right hand
 * moves differently is the thing people struggle with. So the model measures
 * each hand's own rate and scores the quieter one: if even your weaker hand is
 * busy, the piece is hard.
 */
function scoreDifficulty(input: {
  span: number;
  busiestHand: number;
  quietHand: number;
  distinctPitchCount: number;
  blackKeyFraction: number;
}): DifficultyFactor[] {
  return [
    {
      key: "speed",
      label: "音符有多密",
      reading: `每秒 ${input.busiestHand.toFixed(1)} 个音`,
      weight: clamp01(input.busiestHand / 7),
    },
    {
      key: "independence",
      label: "另一只手有多忙",
      reading:
        input.quietHand === 0 ? "只用一只手" : `每秒 ${input.quietHand.toFixed(1)} 个音`,
      weight: clamp01(input.quietHand / 2.4),
    },
    {
      key: "reach",
      label: "手要跨多远",
      // 用的是 keysSpanned 而不是 span：与 piece.ts 报出的、含两端的同一个数，
      // 这样同一页上两处出现的数字永远不会互相打架。
      reading: `跨过 88 个键中的 ${input.span + 1} 个`,
      weight: clamp01((input.span - 12) / 38),
    },
    {
      key: "variety",
      label: "用了多少个不同的键",
      reading: `88 个键里用到 ${input.distinctPitchCount} 个`,
      weight: clamp01((input.distinctPitchCount - 6) / 28),
    },
    {
      key: "blackkeys",
      label: "黑键",
      reading: `${Math.round(input.blackKeyFraction * 100)}% 的音符在黑键上`,
      weight: clamp01(input.blackKeyFraction / 0.34),
    },
  ];
}

const FACTOR_WEIGHTS: Record<string, number> = {
  speed: 0.3,
  independence: 0.24,
  reach: 0.2,
  variety: 0.14,
  blackkeys: 0.12,
};

/**
 * Thresholds rather than a rounded average. Averaging five factors pulls almost
 * everything to the middle: the first version put seven of twelve real pieces
 * in the same grade, which tells a learner nothing.
 */
function gradeFrom(factors: DifficultyFactor[]): Analysis["difficulty"] {
  const score = factors.reduce((sum, f) => sum + f.weight * (FACTOR_WEIGHTS[f.key] ?? 0), 0);
  if (score < 0.16) return 1;
  if (score < 0.3) return 2;
  if (score < 0.45) return 3;
  if (score < 0.62) return 4;
  return 5;
}

/**
 * How many notes a second each hand plays. Uses the file's own tracks when it
 * has two, and otherwise splits the notes at middle C — which is roughly where
 * the hands divide on a piano.
 */
function handRates(
  notes: { midi: number; time: number; duration: number }[],
  tracks: { notes: { midi: number }[] }[],
  duration: number,
  twoHands: boolean,
): [number, number] {
  if (duration <= 0) return [0, 0];
  const withNotes = tracks.filter((t) => t.notes.length > 0);

  let groups: number[];
  if (withNotes.length >= 2) {
    groups = withNotes.map((t) => t.notes.length / duration);
  } else if (twoHands) {
    const low = notes.filter((n) => n.midi < 60).length / duration;
    const high = notes.filter((n) => n.midi >= 60).length / duration;
    groups = [low, high];
  } else {
    return [notes.length / duration, 0];
  }

  groups.sort((a, b) => b - a);
  return [groups[0], groups[groups.length - 1]];
}

/** Largest number of notes sounding at the same instant. */
function maxOverlap(notes: { time: number; duration: number }[]): number {
  const events: [number, number][] = [];
  for (const n of notes) {
    events.push([n.time, 1]);
    events.push([n.time + Math.max(n.duration, 0.01), -1]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let current = 0;
  let max = 0;
  for (const [, delta] of events) {
    current += delta;
    if (current > max) max = current;
  }
  return max;
}

/**
 * Correlate the piece's pitch-class durations against the Krumhansl–Kessler
 * profiles. Only used when the file declares no key signature, and the result
 * is always labelled as an estimate in the interface.
 */
function estimateKey(notes: { midi: number; duration: number }[]): string {
  const weights = new Array(12).fill(0);
  // Cap each note's contribution: a left hand holding open fifths for two beats
  // a bar should not outvote every melody note in the piece.
  for (const n of notes) {
    weights[((n.midi % 12) + 12) % 12] += Math.min(Math.max(n.duration, 0.05), 0.75);
  }

  let best = { score: -Infinity, tonic: 0, scale: "major" };
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const [scale, profile] of [
      ["major", MAJOR_PROFILE],
      ["minor", MINOR_PROFILE],
    ] as const) {
      const rotated = profile.map((_, i) => profile[(i - tonic + 12) % 12]);
      const score = correlate(weights, rotated);
      if (score > best.score) best = { score, tonic, scale };
    }
  }
  return `${PITCH_NAMES[best.tonic]} ${best.scale}`;
}

function correlate(a: number[], b: number[]): number {
  const meanA = a.reduce((s, v) => s + v, 0) / a.length;
  const meanB = b.reduce((s, v) => s + v, 0) / b.length;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < a.length; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}

/**
 * Decides which hand each track belongs to, by how high the track sits.
 *
 * Returns an empty array when the file has fewer than two tracks with notes in
 * it, which is the caller's signal to fall back to splitting on middle C.
 */
function assignHands(tracks: { notes: { midi: number }[] }[]): (0 | 1)[] {
  const playing = tracks
    .map((track, index) => ({ index, median: median(track.notes.map((n) => n.midi)) }))
    .filter((t) => t.median !== null);
  if (playing.length < 2) return [];

  // Two tracks is the ordinary case and needs no threshold: the higher one is
  // the right hand. With more, each track takes the side of the middle track.
  const medians = playing.map((t) => t.median as number).sort((a, b) => a - b);
  const pivot = medians[Math.floor(medians.length / 2)];
  const out: (0 | 1)[] = new Array(tracks.length).fill(0);
  for (const track of playing) {
    out[track.index] = (track.median as number) >= pivot ? 1 : 0;
  }
  // A pivot every track ties on would put every note in one hand; split on
  // pitch in that case rather than claim a hand the file does not show.
  if (out.every((h) => h === out[playing[0].index])) return [];
  return out;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Every note as [start, pitch, length, hand] with times in permille of the
 * piece, so the thumbnail is the real note field and not a chart about it.
 * Evenly sampled down when a piece has more notes than the map needs.
 */
function buildPitchMap(
  notes: { time: number; midi: number; duration: number; hand?: 0 | 1 }[],
  duration: number,
  byTrack: boolean,
): [number, number, number, number][] {
  const step = Math.max(1, Math.ceil(notes.length / MAX_PITCH_MAP_NOTES));
  const out: [number, number, number, number][] = [];
  for (let i = 0; i < notes.length; i += step) {
    const n = notes[i];
    out.push([
      Math.round((n.time / duration) * 1000),
      n.midi,
      Math.max(1, Math.round((n.duration / duration) * 1000)),
      byTrack && n.hand !== undefined ? n.hand : n.midi >= 60 ? 1 : 0,
    ]);
  }
  return out;
}

/** "beethoven-fur-elise.mid" → "Für Elise". Filenames are input, not titles. */
export function titleFromFilename(filename: string, embedded?: string): string {
  const embeddedName = embedded?.trim();
  if (embeddedName && embeddedName.length > 1 && !/^untitled/i.test(embeddedName)) {
    return embeddedName;
  }
  const stem = filename.replace(/\.(mid|midi)$/i, "");
  const parts = stem.split("-");
  const withoutComposer = KNOWN_COMPOSERS[parts[0]?.toLowerCase()] ? parts.slice(1) : parts;
  const words = withoutComposer.join(" ").replace(/[_]+/g, " ").trim();
  return applyKnownSpellings(titleCase(words || stem));
}

export function composerFromFilename(filename: string): string | null {
  const stem = filename.replace(/\.(mid|midi)$/i, "");
  const first = stem.split("-")[0]?.toLowerCase();
  return (first && KNOWN_COMPOSERS[first]) ?? null;
}

const KNOWN_COMPOSERS: Record<string, string> = {
  bach: "J.S. Bach",
  gruber: "Franz Gruber",
  joplin: "Scott Joplin",
  pachelbel: "Johann Pachelbel",
  rimsky: "Nikolai Rimsky-Korsakov",
  petzold: "Christian Petzold",
  trad: "Traditional",
  traditional: "Traditional",
  beethoven: "Beethoven",
  brahms: "Brahms",
  chopin: "Chopin",
  debussy: "Debussy",
  grieg: "Grieg",
  handel: "Handel",
  haydn: "Haydn",
  liszt: "Liszt",
  mozart: "Mozart",
  satie: "Erik Satie",
  schubert: "Schubert",
  schumann: "Schumann",
  tchaikovsky: "Tchaikovsky",
};

/** Filenames lose their accents; a couple of well-known titles get them back. */
const KNOWN_SPELLINGS: [RegExp, string][] = [
  [/^fur elise$/i, "Für Elise"],
  [/^clair de lune$/i, "Clair de Lune"],
  [/^gymnopedie(\s+no\.?\s*(\d))?$/i, "Gymnopédie"],
];

function applyKnownSpellings(title: string): string {
  for (const [pattern, replacement] of KNOWN_SPELLINGS) {
    if (pattern.test(title)) return title.replace(pattern, replacement);
  }
  return title;
}

function titleCase(input: string): string {
  const small = new Set(["a", "an", "and", "the", "in", "of", "on", "for", "de", "la", "le"]);
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) =>
      i > 0 && small.has(word.toLowerCase())
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function round(n: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(n * factor) / factor;
}
