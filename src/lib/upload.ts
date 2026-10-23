import { analyseMidi } from "./midi";
import { checkFile } from "./accept";
import { findDuplicate, insertPiece, isUniqueViolation } from "./db";
import { sha256 } from "./hash";
import type { Piece } from "./piece";
import { saveMidi } from "./storage";

export type UploadResult =
  | { ok: true; piece: Piece }
  | { ok: false; error: string; detail?: string; duplicateOf?: string };

/**
 * Adding a song, now that there is no server to ask.
 *
 * The old pipeline did this twice: the browser validated the file and posted it,
 * the route validated it again and wrote the row. With no network between the
 * two halves there is one place, so there is one pass — but the order still
 * matters. Nothing is written until the file has parsed and been measured, so a
 * dropped file that is not really MIDI leaves no row and no orphan on disk.
 */
export async function addFile(file: File): Promise<UploadResult> {
  const rejected = checkFile(file.name, file.size);
  if (rejected) return { ok: false, error: rejected.error, detail: rejected.detail };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const checksum = await sha256(bytes);

  // Same bytes, different name: the catalogue keeps one copy and says which.
  const existing = await findDuplicate(checksum);
  if (existing) {
    return {
      ok: false,
      error: "You already have this one.",
      detail: `It is in your book as "${existing.title}" — the file is identical, whatever it was called.`,
      duplicateOf: existing.id,
    };
  }

  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  let analysis;
  try {
    analysis = analyseMidi(buffer as ArrayBuffer, file.name);
  } catch {
    return {
      ok: false,
      error: `"${file.name}" could not be read.`,
      detail:
        "The file is named like a MIDI file but its contents are not. Try exporting it again from Songscription.",
    };
  }

  const storagePath = `${checksum.slice(0, 16)}-${sanitise(file.name)}`;
  await saveMidi(storagePath, bytes);

  try {
    const piece = await insertPiece({
      title: analysis.title,
      composer: analysis.composer,
      source_filename: file.name,
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
    });
    return { ok: true, piece };
  } catch (error) {
    // Two drops of the same file can pass the lookup together. The unique index
    // is the thing that actually decides, so losing that race is a duplicate,
    // not a failure.
    if (isUniqueViolation(error)) {
      const winner = await findDuplicate(checksum);
      return {
        ok: false,
        error: "You already have this one.",
        detail: winner
          ? `It is in your book as "${winner.title}" — the file is identical, whatever it was called.`
          : "The file is identical to one already in your book.",
        duplicateOf: winner?.id,
      };
    }
    throw error;
  }
}

function sanitise(filename: string): string {
  return filename.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").slice(0, 80);
}
