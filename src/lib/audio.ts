import { Midi } from "@tonejs/midi";
import { readMidi } from "./storage";

/**
 * A piano that plays the whole piece, from wherever you point it.
 *
 * Playback reads the .mid itself rather than `pitch_map`: the map's times are
 * permille of the piece, which on a five-minute file is a 300ms grid, so every
 * note would land on the wrong beat. The map is the right resolution for
 * drawing a picture and the wrong one for rhythm.
 *
 * Notes are scheduled in a rolling window rather than all at once. A long piece
 * is thousands of notes and each one is seven nodes, so scheduling the lot up
 * front is tens of thousands of live nodes and a locked tab; the scheduler
 * keeps about a second of music queued and tops it up on a timer.
 *
 * The voice is additive rather than a sampler: a sampled piano is megabytes of
 * audio for something the browser can make. Partials, a hammer transient and a
 * small room get most of the way there for nothing.
 */

/** How far ahead of the clock notes are queued, and how often that is topped up. */
const LOOKAHEAD_SECONDS = 1.1;
const TICK_MS = 80;

// Amplitude of each harmonic, and how much faster it dies away than the
// fundamental. Upper partials fading first is most of what makes a struck
// string sound struck.
const PARTIALS = [
  { ratio: 1, gain: 1.0, decay: 1.0 },
  { ratio: 2, gain: 0.38, decay: 1.7 },
  { ratio: 3, gain: 0.2, decay: 2.4 },
  { ratio: 4, gain: 0.1, decay: 3.2 },
  { ratio: 5, gain: 0.055, decay: 4.2 },
  { ratio: 6, gain: 0.03, decay: 5.4 },
];

/** Middle C. Only used when a file names no hands of its own. */
const MIDDLE_C = 60;

export type Note = {
  midi: number;
  time: number;
  duration: number;
  velocity: number;
  /** 0 left, 1 right — from the file's own tracks where it has more than one. */
  hand: 0 | 1;
};

/** Which notes are sounding right now, so the keyboard can show them. */
export type ActiveNotes = { midi: number; hand: "left" | "right" }[];

export type Transport = {
  /** Seconds into the piece. */
  position: number;
  /** Seconds the piece runs for. */
  duration: number;
};

let context: AudioContext | null = null;
let impulse: AudioBuffer | null = null;
let generation = 0;
const cache = new Map<string, Note[]>();

function audio(): AudioContext {
  if (!context) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    context = new Ctor();
  }
  return context;
}

/**
 * A small generated room.
 *
 * The impulse response is built once and shared, but every playback gets its
 * own ConvolverNode. Reusing one convolver was the bug behind hearing the end
 * of the last piece under the start of the next one: a convolver holds the tail
 * of whatever it has been fed.
 */
function reverb(ctx: AudioContext): ConvolverNode {
  if (!impulse) {
    const seconds = 1.5;
    const length = Math.floor(ctx.sampleRate * seconds);
    impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6) * 0.6;
      }
    }
  }
  const node = ctx.createConvolver();
  node.buffer = impulse;
  return node;
}

/** Splits the file's tracks into hands by how high each one sits. */
function handOfTrack(tracks: { notes: { midi: number }[] }[]): (0 | 1)[] {
  const playing = tracks
    .map((track, index) => ({ index, median: median(track.notes.map((n) => n.midi)) }))
    .filter((t): t is { index: number; median: number } => t.median !== null);
  if (playing.length < 2) return [];

  const medians = playing.map((t) => t.median).sort((a, b) => a - b);
  const pivot = medians[Math.floor(medians.length / 2)];
  const out: (0 | 1)[] = new Array(tracks.length).fill(0);
  for (const track of playing) out[track.index] = track.median >= pivot ? 1 : 0;
  if (out.every((h) => h === out[playing[0].index])) return [];
  return out;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Reads and parses the file once, then keeps the notes.
 *
 * Public because the roll draws from exactly the notes that will be played,
 * rather than from the sampled-down `pitch_map` the thumbnails use.
 *
 * The key is the piece's `storage_path`, which is stable for the life of the
 * row, so the cache survives a rename and needs no invalidation.
 */
export async function loadNotes(source: string): Promise<Note[]> {
  const hit = cache.get(source);
  if (hit) return hit;
  const bytes = await readMidi(source);
  const midi = new Midi(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  const hands = handOfTrack(midi.tracks);
  const notes: Note[] = midi.tracks
    .flatMap((track, index) =>
      track.notes.map((n) => ({
        midi: n.midi,
        time: n.time,
        duration: n.duration,
        velocity: n.velocity,
        hand: (hands.length > 0 ? hands[index] : n.midi >= MIDDLE_C ? 1 : 0) as 0 | 1,
      })),
    )
    .sort((a, b) => a.time - b.time);
  cache.set(source, notes);
  return notes;
}

export function durationOf(notes: Note[]): number {
  const last = notes[notes.length - 1];
  return last ? last.time + last.duration : 0;
}

/** Every source a note creates, so a stop can silence them rather than wait. */
type Voice = { source: { stop: (when: number) => void }; until: number };

function strike(
  ctx: AudioContext,
  destination: AudioNode,
  voices: Voice[],
  midi: number,
  at: number,
  held: number,
  velocity: number,
) {
  const frequency = 440 * Math.pow(2, (midi - 69) / 12);

  // Low notes ring far longer than high ones, as on a real instrument.
  const ring = Math.min(6, Math.max(0.45, 900 / frequency)) * 1.15;
  const length = Math.min(ring, Math.max(held, 0.16) + ring * 0.55);
  const loudness = (0.16 + velocity * 0.24) * (midi < 52 ? 1.25 : midi > 84 ? 0.62 : 1);

  const voice = ctx.createGain();
  voice.gain.value = loudness;
  voice.connect(destination);

  for (const partial of PARTIALS) {
    // A real string is slightly inharmonic, which is a lot of why a piano
    // sounds like a piano and an organ does not.
    const stretch = Math.sqrt(1 + 0.0004 * partial.ratio * partial.ratio);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = frequency * partial.ratio * stretch;

    const gain = ctx.createGain();
    const peak = partial.gain * (0.35 + velocity * 0.65);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length / partial.decay + 0.05);

    osc.connect(gain);
    gain.connect(voice);
    osc.start(at);
    osc.stop(at + length + 0.1);
    voices.push({ source: osc, until: at + length + 0.1 });
  }

  // The hammer: a very short filtered noise burst that gives the note an edge.
  const noise = ctx.createBufferSource();
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.03), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  noise.buffer = buffer;

  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = Math.min(frequency * 3, 5200);
  band.Q.value = 0.7;

  const hammer = ctx.createGain();
  hammer.gain.setValueAtTime(0.05 * velocity, at);
  hammer.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);

  noise.connect(band);
  band.connect(hammer);
  hammer.connect(voice);
  noise.start(at);
  noise.stop(at + 0.06);
  voices.push({ source: noise, until: at + 0.06 });
}

type Playback = {
  id: string;
  notes: Note[];
  duration: number;
  /** Where in the piece the clock was when this run started. */
  from: number;
  /** ctx.currentTime at which `from` was heard. */
  began: number;
  next: number;
  voices: Voice[];
  timer: number;
  frame: number;
  master: GainNode;
  bus: GainNode;
  room: ConvolverNode;
  wet: GainNode;
  onEnd: () => void;
  onActive?: (active: ActiveNotes) => void;
  onTime?: (t: Transport) => void;
  stop: () => void;
};

let current: Playback | null = null;

export function nowPlaying(): string | null {
  return current?.id ?? null;
}

export function stop() {
  current?.stop();
  current = null;
}

/** Jumps to a point in the piece that is already playing. */
export function seek(seconds: number) {
  const run = current;
  if (!run) return;
  const ctx = audio();
  const at = Math.max(0, Math.min(seconds, run.duration));

  // Cut what is ringing before moving, or the old chord follows you there.
  silence(run, ctx.currentTime);
  run.voices = [];
  run.from = at;
  run.began = ctx.currentTime + 0.06;
  run.next = firstAfter(run.notes, at);
  run.master.gain.cancelScheduledValues(ctx.currentTime);
  run.master.gain.setValueAtTime(0.85, ctx.currentTime);
  run.onActive?.([]);
  run.onTime?.({ position: at, duration: run.duration });
}

function firstAfter(notes: Note[], seconds: number): number {
  let low = 0;
  let high = notes.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (notes[mid].time < seconds) low = mid + 1;
    else high = mid;
  }
  return low;
}

function silence(run: Playback, when: number) {
  for (const voice of run.voices) {
    try {
      voice.source.stop(when);
    } catch {
      // already stopped, or never started
    }
  }
}

/**
 * Plays a piece from `from` seconds in. Resolves once playback has started;
 * `onEnd` fires when it reaches the end or is interrupted, `onActive` on every
 * change to the sounding set, and `onTime` on every frame.
 */
export async function play(
  id: string,
  source: string,
  handlers: {
    onEnd: () => void;
    onActive?: (active: ActiveNotes) => void;
    onTime?: (t: Transport) => void;
  },
  from = 0,
): Promise<void> {
  stop();

  // Two clicks can be in flight at once when the second file is still loading.
  // A token settles which one owns the output; checking `current` could not,
  // because stop() clears it and both callers then saw the coast as clear.
  const token = ++generation;

  const ctx = audio();
  await ctx.resume();

  let notes: Note[];
  try {
    notes = await loadNotes(source);
  } catch {
    if (token === generation) handlers.onEnd();
    return;
  }
  if (token !== generation) return;

  const master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(ctx.destination);

  const room = reverb(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.22;
  room.connect(wet);
  wet.connect(master);

  const bus = ctx.createGain();
  bus.connect(master);
  bus.connect(room);

  const duration = durationOf(notes);
  const start = Math.max(0, Math.min(from, duration));

  const run: Playback = {
    id,
    notes,
    duration,
    from: start,
    began: ctx.currentTime + 0.12,
    next: firstAfter(notes, start),
    voices: [],
    timer: 0,
    frame: 0,
    master,
    bus,
    room,
    wet,
    onEnd: handlers.onEnd,
    onActive: handlers.onActive,
    onTime: handlers.onTime,
    stop: () => {
      window.clearInterval(run.timer);
      cancelAnimationFrame(run.frame);
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      // Silence the notes themselves rather than only turning them down: a
      // scheduled oscillator left running still feeds this run's reverb.
      silence(run, t + 0.14);
      window.setTimeout(() => {
        bus.disconnect();
        room.disconnect();
        wet.disconnect();
        master.disconnect();
      }, 320);
      run.onActive?.([]);
      run.onEnd();
    },
  };
  current = run;

  const position = () => run.from + (ctx.currentTime - run.began);

  // The scheduler: queue the next second of music, then go back to sleep.
  const pump = () => {
    if (current !== run) return;
    const horizon = position() + LOOKAHEAD_SECONDS;
    while (run.next < notes.length && notes[run.next].time <= horizon) {
      const note = notes[run.next++];
      const at = run.began + (note.time - run.from);
      if (at > ctx.currentTime - 0.02) {
        strike(ctx, run.bus, run.voices, note.midi, at, note.duration, note.velocity || 0.8);
      }
    }
    // Voices that have finished are dropped so a long piece does not carry
    // every note it has ever played in memory.
    const now = ctx.currentTime;
    if (run.voices.length > 600) run.voices = run.voices.filter((v) => v.until > now);

    if (run.next >= notes.length && position() >= run.duration + 1.2) {
      current = null;
      window.clearInterval(run.timer);
      cancelAnimationFrame(run.frame);
      run.onActive?.([]);
      run.onTime?.({ position: run.duration, duration: run.duration });
      run.onEnd();
    }
  };

  let lastKey = "";
  const follow = () => {
    if (current !== run) return;
    const t = position();
    run.onTime?.({ position: Math.max(0, Math.min(t, run.duration)), duration: run.duration });

    const active: ActiveNotes = [];
    // Only the window around now can be sounding, so this never walks the piece.
    for (let i = firstAfter(notes, t - 4); i < notes.length; i++) {
      const note = notes[i];
      if (note.time > t) break;
      if (t < note.time + Math.max(note.duration, 0.12)) {
        active.push({ midi: note.midi, hand: note.hand === 0 ? "left" : "right" });
      }
    }
    const key = active.map((n) => n.midi).join(",");
    if (key !== lastKey) {
      lastKey = key;
      run.onActive?.(active);
    }
    run.frame = requestAnimationFrame(follow);
  };

  pump();
  run.timer = window.setInterval(pump, TICK_MS);
  run.frame = requestAnimationFrame(follow);
}
