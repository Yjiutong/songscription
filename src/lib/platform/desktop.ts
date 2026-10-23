import { invoke } from "@tauri-apps/api/core";
import type { MidiStore, Platform, SqlEngine, SqlParam } from "./types";

/**
 * The desktop implementation.
 *
 * Rust owns nothing but the bridge: three statements go in (`run`, `all`,
 * `exec`) and five file calls. It does not know what a piece is, it does not
 * own the schema, and it never sees the difficulty score. That is deliberate —
 * the interesting code stays in one language, and the shell stays small enough
 * to read in one sitting.
 */

function toBase64(bytes: Uint8Array): string {
  // One String.fromCharCode per 32k slice: spreading a megabyte into arguments
  // overflows the stack on every engine.
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

const sql: SqlEngine = {
  run: (statement: string, params: SqlParam[] = []) => invoke<number>("db_run", { sql: statement, params }),
  all: <T,>(statement: string, params: SqlParam[] = []) =>
    invoke<T[]>("db_all", { sql: statement, params }),
  exec: (statement: string) => invoke<void>("db_exec", { sql: statement }),
};

const midi: MidiStore = {
  write: (name, bytes) => invoke<void>("midi_write", { name, data: toBase64(bytes) }),
  read: async (name) => fromBase64(await invoke<string>("midi_read", { name })),
  remove: (name) => invoke<void>("midi_remove", { name }),
  exists: (name) => invoke<boolean>("midi_exists", { name }),
  reveal: (name) => invoke<void>("midi_reveal", { name }),
};

export function createDesktopPlatform(): Platform {
  return {
    kind: "desktop",
    sql,
    midi,
    location: () => invoke<string>("catalogue_dir"),
  };
}
