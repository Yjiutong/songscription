/**
 * What the catalogue will and will not accept from a person.
 *
 * Pure, and separate from the pipeline that stores things, for two reasons: the
 * rules are the part worth testing without a database, and every one of these
 * messages is read by someone who has just dropped the wrong file on a window.
 */

export type Rejection = { status: number; error: string; detail: string };

/** A .mid is kilobytes. 2 MB is already absurd, and anything larger is audio. */
export const MAX_BYTES = 2 * 1024 * 1024;

export function checkFile(name: string, size: number): Rejection | null {
  if (!/\.(mid|midi)$/i.test(name)) {
    return {
      status: 415,
      error: `"${name}" is not a MIDI file.`,
      detail:
        "This catalogue takes .mid and .midi files — the ones Songscription gives you when a transcription finishes.",
    };
  }
  if (size === 0) {
    return {
      status: 400,
      error: `"${name}" is empty.`,
      detail: "The file has no contents. Try exporting it again.",
    };
  }
  if (size > MAX_BYTES) {
    return {
      status: 413,
      error: `"${name}" is too large for a MIDI file.`,
      detail: "MIDI files are usually a few kilobytes. Anything over 2 MB is probably audio, not MIDI.",
    };
  }
  return null;
}
