import { getPlatform } from "./platform";

/**
 * The .mid files, beside the database.
 *
 * A storage_path is a *name*, not a path: it is whatever the upload minted
 * (checksum prefix + sanitised filename). The platform resolves it inside the
 * catalogue folder and refuses anything with a separator or a `..` in it, so a
 * row that somehow held "../../etc/passwd" still cannot read outside the store.
 * That check lives in Rust (src-tauri/src/storage.rs) because that is the only
 * place where a filesystem path actually exists.
 */

export async function saveMidi(storagePath: string, bytes: Uint8Array): Promise<void> {
  const platform = await getPlatform();
  await platform.midi.write(storagePath, bytes);
}

export async function readMidi(storagePath: string): Promise<Uint8Array> {
  const platform = await getPlatform();
  return platform.midi.read(storagePath);
}

export async function removeMidi(storagePath: string): Promise<void> {
  const platform = await getPlatform();
  await platform.midi.remove(storagePath);
}

export async function midiExists(storagePath: string): Promise<boolean> {
  const platform = await getPlatform();
  return platform.midi.exists(storagePath);
}

/** Put the file in front of the person, selected in their file manager. */
export async function revealMidi(storagePath: string): Promise<void> {
  const platform = await getPlatform();
  await platform.midi.reveal(storagePath);
}
