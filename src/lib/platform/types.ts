/**
 * What the catalogue needs from the machine it is running on.
 *
 * Three things, because three things are all it ever needed: somewhere to keep
 * rows, somewhere to keep files, and somewhere to put the sheets it prints.
 * Everything above this line — the analysis, the difficulty score, the SQL, the
 * interface — is plain TypeScript that does not care which side of the process
 * boundary it lives on.
 *
 * There are two implementations, and the difference is worth stating plainly:
 *
 *   desktop  Tauri. SQLite (rusqlite) and real folders on disk. The app.
 *   browser  sql.js and IndexedDB. Development only, so `npm run dev` works
 *            without a Rust toolchain. Data lives in the browser profile.
 *
 * Both run the *same* SQL in src/lib/db.ts. A second storage design would have
 * been cheaper to write and would have drifted within a week.
 */

export type SqlParam = string | number | null;

export type SqlEngine = {
  /** Run one statement; resolves with the number of rows it changed. */
  run(sql: string, params?: SqlParam[]): Promise<number>;
  /** Run one query; resolves with plain objects keyed by column name. */
  all<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  /** Run one or more statements with no parameters — schema creation. */
  exec(sql: string): Promise<void>;
};

export type MidiStore = {
  /**
   * Write the bytes for a piece. An existing file is left alone: storage paths
   * carry the checksum, so an existing file is these exact bytes, left behind
   * by an upload whose row never landed. Reusing it is the right answer.
   */
  write(name: string, bytes: Uint8Array): Promise<void>;
  read(name: string): Promise<Uint8Array>;
  remove(name: string): Promise<void>;
  exists(name: string): Promise<boolean>;
  /** Put the file in front of the person — a file manager with it selected. */
  reveal(name: string): Promise<void>;
};

/**
 * A handful of preferences: the background picture, where sheets are written.
 *
 * Kept as one key/value table rather than a typed settings object because the
 * things worth keeping tend to grow, and a migration per setting is worse than
 * reading three keys by name.
 */
export type SettingsStore = {
  all(): Promise<Record<string, unknown>>;
  set(key: string, value: unknown): Promise<void>;
};

export type Background = {
  /** The bytes and their MIME type, or null when nobody has chosen one. */
  read(): Promise<{ bytes: Uint8Array; mime: string } | null>;
  write(bytes: Uint8Array, mime: string): Promise<void>;
  /** Back to whatever the app looked like before — the shader board. */
  clear(): Promise<void>;
};

export type OutputFile = {
  /** A file name, never a path: the boundary resolves it inside the folder. */
  name: string;
  bytes: number;
  /** Seconds since the epoch, newest first. */
  modified: number;
};

/**
 * Where exported sheets go.
 *
 * The desktop app writes them to a real folder the person can move. The browser
 * build has no folder it may write to, so it falls back to the download folder
 * the browser already owns and says so rather than pretending.
 */
export type OutputStore = {
  /** The folder in use — never guessed by the interface, always asked for. */
  dir(): Promise<string>;
  set(dir: string): Promise<void>;
  /** Ask the machine for a folder. Null when there is no dialog to open. */
  pick(): Promise<string | null>;
  list(): Promise<OutputFile[]>;
  write(name: string, bytes: Uint8Array): Promise<void>;
  remove(name: string): Promise<void>;
  /** Show one file, selected, in the machine's file manager. */
  reveal(name: string): Promise<void>;
  openDir(): Promise<void>;
  /** Can these files be managed at all, or are they gone once downloaded? */
  readonly manageable: boolean;
};

export type Platform = {
  /** Which implementation is live. Used only to word the About line honestly. */
  readonly kind: "desktop" | "browser";
  readonly sql: SqlEngine;
  readonly midi: MidiStore;
  readonly settings: SettingsStore;
  readonly background: Background;
  readonly output: OutputStore;
  /** Open the catalogue folder itself, in the machine's file manager. */
  openLocation(): Promise<void>;
  /** Where the catalogue actually lives, in words a person can follow. */
  location(): Promise<string>;
};
