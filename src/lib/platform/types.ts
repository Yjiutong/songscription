/**
 * What the catalogue needs from the machine it is running on.
 *
 * Two things only, because two things are all it ever needed: somewhere to keep
 * rows, and somewhere to keep files. Everything above this line — the analysis,
 * the difficulty score, the SQL, the interface — is plain TypeScript that does
 * not care which side of the process boundary it lives on.
 *
 * There are two implementations, and the difference is worth stating plainly:
 *
 *   desktop  Tauri. SQLite (rusqlite) and a real folder on disk. The app.
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

export type Platform = {
  /** Which implementation is live. Used only to word the About line honestly. */
  readonly kind: "desktop" | "browser";
  readonly sql: SqlEngine;
  readonly midi: MidiStore;
  /** Where the catalogue actually lives, in words a person can follow. */
  location(): Promise<string>;
};
