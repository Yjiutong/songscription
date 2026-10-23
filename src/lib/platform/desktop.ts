import { invoke } from "@tauri-apps/api/core";
import type {
  Background,
  MidiStore,
  OutputFile,
  OutputStore,
  Platform,
  SettingsStore,
  SqlEngine,
  SqlParam,
} from "./types";

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
    settings,
    background,
    output,
    location: () => invoke<string>("catalogue_dir"),
    openLocation: () => invoke<void>("catalogue_open_dir"),
  };
}

// --- the things the interface keeps for itself -----------------------------
//
// Same deal as the rest of the bridge: Rust holds the bytes and nothing else.
// It does not know what a background picture is for.

const settings: SettingsStore = {
  all: () => invoke<Record<string, unknown>>("settings_all"),
  set: (key, value) => invoke<void>("settings_set", { key, value }),
};

const background: Background = {
  // Rust answers Option<(mime, base64)> — a tuple, which arrives as a two-part
  // array. One bright idea down the line ("let's return an object") would not
  // have been wrong either; this one at least cannot be half-nulled.
  read: async () => {
    const pair = await invoke<[string, string] | null>("background_read");
    return pair ? { mime: pair[0], bytes: fromBase64(pair[1]) } : null;
  },
  write: (bytes, mime) => invoke<void>("background_write", { data: toBase64(bytes), mime }),
  clear: () => invoke<void>("background_clear"),
};

const output: OutputStore = {
  // Real files in a real folder, so they can be listed, opened and deleted.
  manageable: true,
  dir: () => invoke<string>("output_dir"),
  set: (dir) => invoke<void>("output_set", { dir }),
  pick: async () => {
    // Loaded on use: the dialog plugin is a few kilobytes nobody wants in the
    // window's start-up path, and most runs never ask for a folder at all.
    const { open } = await import("@tauri-apps/plugin-dialog");
    const chosen = await open({
      directory: true,
      multiple: false,
      title: "选一个放谱面的文件夹",
    });
    return typeof chosen === "string" ? chosen : null;
  },
  list: () => invoke<OutputFile[]>("output_list"),
  write: (name, bytes) => invoke<void>("output_write", { name, data: toBase64(bytes) }),
  remove: (name) => invoke<void>("output_remove", { name }),
  reveal: (name) => invoke<void>("output_reveal", { name }),
  openDir: () => invoke<void>("output_open_dir"),
};
