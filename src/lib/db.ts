import type { DifficultyFactor } from "./midi";
import { matches, type Piece } from "./piece";
import { getPlatform } from "./platform";
import type { SqlParam } from "./platform/types";

/**
 * The catalogue's database.
 *
 * One SQLite file, one schema, one set of statements. What sits underneath is
 * the platform's business (src/lib/platform) — rusqlite in the desktop build,
 * sql.js in the browser development build. Both run *this* SQL, so a query that
 * works in one cannot quietly disagree with the other.
 *
 * The public surface is deliberately narrow — list/get/insert/update/delete,
 * plus a duplicate lookup — so no caller touches SQL directly and the
 * measured-vs-user-owned split stays enforced in one place.
 */

type PieceRow = {
  id: string;
  created_at: string;
  title: string;
  composer: string | null;
  source_filename: string;
  storage_path: string;
  file_size_bytes: number;
  checksum: string;
  duration_seconds: number;
  tempo_bpm: number | null;
  time_signature: string | null;
  key_signature: string | null;
  key_is_estimated: number;
  note_count: number;
  lowest_note: number;
  highest_note: number;
  distinct_pitch_count: number;
  max_simultaneous_notes: number;
  notes_per_second: number;
  black_key_fraction: number;
  track_count: number;
  two_hands: number;
  two_hands_basis: string;
  difficulty: number;
  difficulty_factors: string;
  pitch_map: string;
  notes: string | null;
  in_progress: number;
  is_favourite: number;
  last_practiced_at: string | null;
  practice_seconds: number;
  session_count: number;
};

/**
 * The fields a new row is built from. Identity + measured + the user layer's
 * initial values. `id` and `created_at` are minted here so callers cannot
 * quietly backdate a piece.
 */
export type NewPiece = {
  title: string;
  composer: string | null;
  source_filename: string;
  storage_path: string;
  file_size_bytes: number;
  checksum: string;
  duration_seconds: number;
  tempo_bpm: number | null;
  time_signature: string | null;
  key_signature: string | null;
  key_is_estimated: boolean;
  note_count: number;
  lowest_note: number;
  highest_note: number;
  distinct_pitch_count: number;
  max_simultaneous_notes: number;
  notes_per_second: number;
  black_key_fraction: number;
  track_count: number;
  two_hands: boolean;
  two_hands_basis: string;
  difficulty: number;
  difficulty_factors: DifficultyFactor[];
  pitch_map: Piece["pitch_map"];
  notes?: string | null;
  in_progress?: boolean;
  is_favourite?: boolean;
  last_practiced_at?: string | null;
  practice_seconds?: number;
  session_count?: number;
};

/** The only mutable fields: the user's own layer, never the measured one. */
export const EDITABLE = [
  "in_progress",
  "is_favourite",
  "title",
  "composer",
  "notes",
  "last_practiced_at",
  "practice_seconds",
  "session_count",
] as const;

const SCHEMA = `
create table if not exists pieces (
  id                      text primary key,
  created_at              text not null,

  title                   text not null,
  composer                text,
  source_filename         text not null,
  storage_path            text not null unique,
  file_size_bytes         integer not null check (file_size_bytes > 0),
  checksum                text not null unique,

  duration_seconds        real not null check (duration_seconds > 0),
  tempo_bpm               real,
  time_signature          text,
  key_signature           text,
  key_is_estimated        integer not null default 1,
  note_count              integer not null check (note_count > 0),
  lowest_note             integer not null check (lowest_note between 0 and 127),
  highest_note            integer not null check (highest_note between 0 and 127),
  distinct_pitch_count    integer not null,
  max_simultaneous_notes  integer not null,
  notes_per_second        real not null,
  black_key_fraction      real not null,
  track_count             integer not null,
  two_hands               integer not null,
  two_hands_basis         text not null,
  difficulty              integer not null check (difficulty between 1 and 5),
  difficulty_factors      text not null default '[]',
  pitch_map               text not null default '[]',

  notes                   text,
  in_progress             integer not null default 0,
  is_favourite            integer not null default 0,
  last_practiced_at       text,
  practice_seconds        integer not null default 0 check (practice_seconds >= 0),
  session_count           integer not null default 0 check (session_count >= 0),

  constraint pieces_range_ordered check (highest_note >= lowest_note)
);

create index if not exists pieces_created_at_idx on pieces (created_at desc);
`;

/** The columns of an insert, in the one order the VALUES clause uses. */
const INSERT_COLUMNS = [
  "id",
  "created_at",
  "title",
  "composer",
  "source_filename",
  "storage_path",
  "file_size_bytes",
  "checksum",
  "duration_seconds",
  "tempo_bpm",
  "time_signature",
  "key_signature",
  "key_is_estimated",
  "note_count",
  "lowest_note",
  "highest_note",
  "distinct_pitch_count",
  "max_simultaneous_notes",
  "notes_per_second",
  "black_key_fraction",
  "track_count",
  "two_hands",
  "two_hands_basis",
  "difficulty",
  "difficulty_factors",
  "pitch_map",
  "notes",
  "in_progress",
  "is_favourite",
  "last_practiced_at",
  "practice_seconds",
  "session_count",
] as const;

let ready: Promise<void> | null = null;

/**
 * Create the table if this is a first run. Cheap enough to run on every start,
 * and idempotent by design, so there is no version table to keep honest.
 */
export function openCatalogue(): Promise<void> {
  if (!ready) ready = getPlatform().then((platform) => platform.sql.exec(SCHEMA));
  return ready;
}

function toPiece(row: PieceRow): Piece {
  return {
    id: row.id,
    created_at: row.created_at,
    title: row.title,
    composer: row.composer,
    source_filename: row.source_filename,
    storage_path: row.storage_path,
    file_size_bytes: row.file_size_bytes,
    checksum: row.checksum,
    duration_seconds: row.duration_seconds,
    tempo_bpm: row.tempo_bpm,
    time_signature: row.time_signature,
    key_signature: row.key_signature,
    key_is_estimated: Boolean(row.key_is_estimated),
    note_count: row.note_count,
    lowest_note: row.lowest_note,
    highest_note: row.highest_note,
    distinct_pitch_count: row.distinct_pitch_count,
    max_simultaneous_notes: row.max_simultaneous_notes,
    notes_per_second: row.notes_per_second,
    black_key_fraction: row.black_key_fraction,
    track_count: row.track_count,
    two_hands: Boolean(row.two_hands),
    two_hands_basis: row.two_hands_basis,
    difficulty: row.difficulty,
    difficulty_factors: JSON.parse(row.difficulty_factors) as DifficultyFactor[],
    pitch_map: JSON.parse(row.pitch_map) as Piece["pitch_map"],
    notes: row.notes,
    in_progress: Boolean(row.in_progress),
    is_favourite: Boolean(row.is_favourite),
    last_practiced_at: row.last_practiced_at,
    practice_seconds: row.practice_seconds,
    session_count: row.session_count,
  };
}

export async function countPieces(): Promise<number> {
  await openCatalogue();
  const { sql } = await getPlatform();
  const [row] = await sql.all<{ n: number }>("select count(*) as n from pieces");
  return row?.n ?? 0;
}

/**
 * Everything, newest first. The whole catalogue is read in one go on purpose —
 * see the ceiling noted in src/App.tsx. An optional query filters the same rows
 * with the same `matches()` the browser uses, so there is one definition of what
 * "fur elise" finds.
 */
export async function listPieces(query?: string | null): Promise<Piece[]> {
  await openCatalogue();
  const { sql } = await getPlatform();
  const rows = await sql.all<PieceRow>("select * from pieces order by created_at desc");
  const pieces = rows.map(toPiece);
  const q = query?.trim();
  return q ? pieces.filter((piece) => matches(piece, q)) : pieces;
}

export async function getPiece(id: string): Promise<Piece | null> {
  await openCatalogue();
  const { sql } = await getPlatform();
  const [row] = await sql.all<PieceRow>("select * from pieces where id = ?", [id]);
  return row ? toPiece(row) : null;
}

export async function findDuplicate(
  checksum: string,
): Promise<{ id: string; title: string } | null> {
  await openCatalogue();
  const { sql } = await getPlatform();
  const [row] = await sql.all<{ id: string; title: string }>(
    "select id, title from pieces where checksum = ?",
    [checksum],
  );
  return row ?? null;
}

/** Every row's storage path, so a seed can skip files it already holds. */
export async function listStoragePaths(): Promise<Set<string>> {
  await openCatalogue();
  const { sql } = await getPlatform();
  const rows = await sql.all<{ storage_path: string }>("select storage_path from pieces");
  return new Set(rows.map((row) => row.storage_path));
}

export async function insertPiece(input: NewPiece): Promise<Piece> {
  await openCatalogue();
  const { sql } = await getPlatform();

  const row: Record<(typeof INSERT_COLUMNS)[number], SqlParam> = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    title: input.title,
    composer: input.composer,
    source_filename: input.source_filename,
    storage_path: input.storage_path,
    file_size_bytes: input.file_size_bytes,
    checksum: input.checksum,
    duration_seconds: input.duration_seconds,
    tempo_bpm: input.tempo_bpm,
    time_signature: input.time_signature,
    key_signature: input.key_signature,
    key_is_estimated: input.key_is_estimated ? 1 : 0,
    note_count: input.note_count,
    lowest_note: input.lowest_note,
    highest_note: input.highest_note,
    distinct_pitch_count: input.distinct_pitch_count,
    max_simultaneous_notes: input.max_simultaneous_notes,
    notes_per_second: input.notes_per_second,
    black_key_fraction: input.black_key_fraction,
    track_count: input.track_count,
    two_hands: input.two_hands ? 1 : 0,
    two_hands_basis: input.two_hands_basis,
    difficulty: input.difficulty,
    difficulty_factors: JSON.stringify(input.difficulty_factors),
    pitch_map: JSON.stringify(input.pitch_map),
    notes: input.notes ?? null,
    in_progress: input.in_progress ? 1 : 0,
    is_favourite: input.is_favourite ? 1 : 0,
    last_practiced_at: input.last_practiced_at ?? null,
    practice_seconds: input.practice_seconds ?? 0,
    session_count: input.session_count ?? 0,
  };

  const placeholders = INSERT_COLUMNS.map(() => "?").join(", ");
  await sql.run(
    `insert into pieces (${INSERT_COLUMNS.join(", ")}) values (${placeholders})`,
    INSERT_COLUMNS.map((column) => row[column]),
  );

  const piece = await getPiece(row.id as string);
  if (!piece) throw new Error("The row was written but could not be read back.");
  return piece;
}

/**
 * Apply the user's layer. Fields outside EDITABLE are ignored rather than
 * rejected, so a stale caller sending a measured field cannot rewrite it.
 */
export async function updatePiece(
  id: string,
  patch: Record<string, unknown>,
): Promise<Piece | null> {
  await openCatalogue();
  const entries = Object.entries(patch).filter(([key]) =>
    (EDITABLE as readonly string[]).includes(key),
  );
  if (entries.length === 0) return getPiece(id);

  const { sql } = await getPlatform();
  const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([key, value]) => coerce(key, value));

  const changed = await sql.run(`update pieces set ${assignments} where id = ?`, [...values, id]);
  if (changed === 0) return null;
  return getPiece(id);
}

/** Returns the row that was removed, so the caller can delete its file. */
export async function deletePiece(id: string): Promise<Piece | null> {
  const piece = await getPiece(id);
  if (!piece) return null;
  const { sql } = await getPlatform();
  await sql.run("delete from pieces where id = ?", [id]);
  return piece;
}

function coerce(key: string, value: unknown): SqlParam {
  if (key === "in_progress" || key === "is_favourite") return value ? 1 : 0;
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value;
  return String(value);
}

/**
 * True when a write failed because it collided with a unique column.
 *
 * The two engines word it differently — sql.js throws an Error, rusqlite's
 * message crosses the bridge as a string — but both come from SQLite and both
 * say UNIQUE constraint failed.
 */
export function isUniqueViolation(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : String(error ?? "");
  return /unique constraint failed|sqlite_constraint/i.test(message);
}

/** Where the catalogue lives, for the About line and for backups. */
export async function catalogueLocation(): Promise<string> {
  const platform = await getPlatform();
  return platform.location();
}
