import initSqlJs, { type Database } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { MidiStore, Platform, SqlEngine, SqlParam } from "./types";

/**
 * The browser implementation — for `npm run dev` only.
 *
 * The desktop app runs real SQLite in Rust. Without a Rust toolchain, though,
 * the interface would be unreachable, and an interface nobody can open is not
 * a thing you can evaluate. So this adapter runs the *same* SQLite engine
 * compiled to WebAssembly and keeps the database file in IndexedDB.
 *
 * It is not shipped: `tauri build` produces the desktop binary, which takes the
 * other path. The trade-off is stated in the About line and in the tray of the
 * development build, because data that lives in a browser profile is easier to
 * lose than a file you can see.
 */

const STORE_SQL = "sql";
const STORE_MIDI = "midi";
const DB_KEY = "catalogue.db";

let open: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (open) return open;
  open = new Promise((resolve, reject) => {
    const request = indexedDB.open("songscription", 1);
    request.onupgradeneeded = () => {
      const handle = request.result;
      if (!handle.objectStoreNames.contains(STORE_SQL)) handle.createObjectStore(STORE_SQL);
      if (!handle.objectStoreNames.contains(STORE_MIDI)) handle.createObjectStore(STORE_MIDI);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB refused to open."));
  });
  return open;
}

async function get<T>(store: string, key: string): Promise<T | undefined> {
  const handle = await db();
  return new Promise((resolve, reject) => {
    const request = handle.transaction(store, "readonly").objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function put(store: string, key: string, value: unknown): Promise<void> {
  const handle = await db();
  return new Promise((resolve, reject) => {
    const tx = handle.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function del(store: string, key: string): Promise<void> {
  const handle = await db();
  return new Promise((resolve, reject) => {
    const tx = handle.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function engine(database: Database): SqlEngine {
  // The whole database is kilobytes and writes happen on a human's timescale,
  // so the file is rewritten after each write rather than tracked incrementally.
  const persist = () => put(STORE_SQL, DB_KEY, database.export());

  return {
    run: async (statement: string, params: SqlParam[] = []) => {
      database.run(statement, params);
      const changed = database.getRowsModified();
      await persist();
      return changed;
    },
    all: async <T>(statement: string, params: SqlParam[] = []): Promise<T[]> => {
      const result = database.exec(statement, params);
      if (result.length === 0) return [];
      const { columns, values } = result[0];
      return values.map(
        (row) => Object.fromEntries(row.map((value, index) => [columns[index], value])) as T,
      );
    },
    exec: async (statement: string) => {
      database.run(statement);
      await persist();
    },
  };
}

export async function createBrowserPlatform(): Promise<Platform> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const saved = await get<Uint8Array>(STORE_SQL, DB_KEY);
  const database = saved ? new SQL.Database(new Uint8Array(saved)) : new SQL.Database();

  const midi: MidiStore = {
    write: async (name, bytes) => {
      // Same rule as the desktop store: a file already there is these bytes.
      if (await get(STORE_MIDI, name)) return;
      await put(STORE_MIDI, name, bytes);
    },
    read: async (name) => {
      const bytes = await get<Uint8Array>(STORE_MIDI, name);
      if (!bytes) throw new Error(`No .mid stored for "${name}".`);
      return new Uint8Array(bytes);
    },
    remove: (name) => del(STORE_MIDI, name),
    exists: async (name) => Boolean(await get(STORE_MIDI, name)),
    reveal: async (name) => {
      // There is no file manager to open, so hand the person the file itself.
      const bytes = await get<Uint8Array>(STORE_MIDI, name);
      if (!bytes) return;
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type: "audio/midi" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      URL.revokeObjectURL(url);
    },
  };

  return {
    kind: "browser",
    sql: engine(database),
    midi,
    location: async () => "this browser's storage (development build — not a folder on disk)",
  };
}
