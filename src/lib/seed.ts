import { analyseMidi } from "./midi";
import { countPieces, findDuplicate, insertPiece } from "./db";
import { sha256 } from "./hash";
import { saveMidi } from "./storage";

/**
 * First-run seeding.
 *
 * A brand-new install has an empty database and nothing to look at. Rather than
 * asking the reader to upload nine files before the product makes sense, the
 * same analyser an upload uses measures the bundled seed library once and writes
 * real rows. Nothing here is special-cased: every row goes through insertPiece
 * exactly as an upload does, so the seeded shelf cannot contain a shape the real
 * flow could never produce.
 *
 * The .mid files are bundled *into the app* rather than read from a folder
 * beside it, because there is no beside — a packaged desktop app is one binary.
 * Vite turns each of these into a hashed asset URL the webview can fetch.
 *
 * It runs only when the table is empty, so deleting a song does not bring it
 * back on the next launch.
 */

const SEED_FILES = import.meta.glob("../assets/seed/*.mid", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

type History = {
  /** null means "never played"; the number is days since the last session. */
  daysAgo: number | null;
  inProgress?: boolean;
  favourite?: boolean;
  sessions: number;
};

/** The histories the library shipped with, so it reads like one somebody built up over time. */
const HISTORY: Record<string, History> = {
  "beethoven-fur-elise.mid": { daysAgo: 0, inProgress: true, favourite: true, sessions: 14 },
  "petzold-minuet-in-g.mid": { daysAgo: 2, sessions: 9 },
  "gruber-silent-night.mid": { daysAgo: 4, sessions: 5 },
  "pachelbel-canon-in-d.mid": { daysAgo: 7, favourite: true, sessions: 3 },
  "beethoven-ode-to-joy.mid": { daysAgo: 12, favourite: true, sessions: 11 },
  "trad-amazing-grace.mid": { daysAgo: 16, sessions: 6 },
  "trad-greensleeves.mid": { daysAgo: 19, sessions: 7 },
  "trad-twinkle-twinkle.mid": { daysAgo: 24, sessions: 4 },
  "beethoven-moonlight-sonata.mid": { daysAgo: null, sessions: 0 },
};

// Two cold starts arriving at once must not both analyse the shelf.
let inFlight: Promise<number> | null = null;

export function ensureSeeded(): Promise<number> {
  if (inFlight) return inFlight;
  inFlight = seedFromBundle().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Analyse every bundled .mid and add the ones not already present. */
export async function seedFromBundle(): Promise<number> {
  if ((await countPieces()) > 0) return 0;

  let added = 0;

  for (const [path, url] of Object.entries(SEED_FILES)) {
    const name = path.split("/").pop() ?? path;
    if (!/\.(mid|midi)$/i.test(name)) continue;

    const response = await fetch(url);
    if (!response.ok) continue;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const checksum = await sha256(bytes);

    if (await findDuplicate(checksum)) continue;

    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    let analysis;
    try {
      analysis = analyseMidi(buffer as ArrayBuffer, name);
    } catch {
      // A seed file that will not parse is not worth failing startup over.
      continue;
    }

    const storagePath = `${checksum.slice(0, 16)}-${sanitise(name)}`;
    await saveMidi(storagePath, bytes);

    const history = HISTORY[name] ?? { daysAgo: null, sessions: 0 };

    await insertPiece({
      title: analysis.title,
      composer: analysis.composer,
      source_filename: name,
      storage_path: storagePath,
      file_size_bytes: bytes.byteLength,
      checksum,
      duration_seconds: analysis.durationSeconds,
      tempo_bpm: analysis.tempoBpm,
      time_signature: analysis.timeSignature,
      key_signature: analysis.keySignature,
      key_is_estimated: analysis.keyIsEstimated,
      note_count: analysis.noteCount,
      lowest_note: analysis.lowestNote,
      highest_note: analysis.highestNote,
      distinct_pitch_count: analysis.distinctPitchCount,
      max_simultaneous_notes: analysis.maxSimultaneousNotes,
      notes_per_second: analysis.notesPerSecond,
      black_key_fraction: analysis.blackKeyFraction,
      track_count: analysis.trackCount,
      two_hands: analysis.twoHands,
      two_hands_basis: analysis.twoHandsBasis,
      difficulty: analysis.difficulty,
      difficulty_factors: analysis.difficultyFactors,
      pitch_map: analysis.pitchMap,
      in_progress: history.inProgress ?? false,
      is_favourite: history.favourite ?? false,
      last_practiced_at:
        history.daysAgo === null
          ? null
          : new Date(Date.now() - history.daysAgo * 86_400_000).toISOString(),
      practice_seconds: history.sessions * 9 * 60,
      session_count: history.sessions,
    });

    added++;
  }

  return added;
}

function sanitise(filename: string): string {
  return filename.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").slice(0, 80);
}
