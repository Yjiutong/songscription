import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  countPieces,
  deletePiece,
  findDuplicate,
  insertPiece,
  isUniqueViolation,
  listPieces,
  openCatalogue,
  updatePiece,
  type NewPiece,
} from "./db.ts";
import { setPlatform } from "./platform/index.ts";
import type { Platform, SqlParam } from "./platform/types.ts";

/**
 * The data layer, run against a real SQLite.
 *
 * This is the one part of the app that cannot be checked by reading it: an
 * insert that lists thirty-two columns in one order and binds them in another
 * looks perfectly reasonable in review and fails at runtime. So the platform is
 * swapped for a Node SQLite and the *same* statements the desktop build runs are
 * executed here.
 *
 * What this cannot cover is the bridge itself — whether Rust returns these rows
 * in the same shape. That needs `npm run desktop`.
 */

function memoryPlatform(): Platform {
  const db = new Database(":memory:");
  return {
    kind: "desktop",
    sql: {
      run: async (sql: string, params: SqlParam[] = []) => db.prepare(sql).run(...params).changes,
      all: async <T>(sql: string, params: SqlParam[] = []) => db.prepare(sql).all(...params) as T[],
      exec: async (sql: string) => {
        db.exec(sql);
      },
    },
    midi: {
      write: async () => {},
      read: async () => new Uint8Array(),
      remove: async () => {},
      exists: async () => false,
      reveal: async () => {},
    },
    location: async () => ":memory:",
  };
}

function piece(overrides: Partial<NewPiece> = {}): NewPiece {
  return {
    title: "Für Elise",
    composer: "Beethoven",
    source_filename: "beethoven-fur-elise.mid",
    storage_path: "aaaaaaaabbbbbbbb-beethoven-fur-elise.mid",
    file_size_bytes: 4_480,
    checksum: "a".repeat(64),
    duration_seconds: 112.5,
    tempo_bpm: 72,
    time_signature: "3/8",
    key_signature: "A minor",
    key_is_estimated: false,
    note_count: 214,
    lowest_note: 52,
    highest_note: 88,
    distinct_pitch_count: 18,
    max_simultaneous_notes: 3,
    notes_per_second: 1.9,
    black_key_fraction: 0.14,
    track_count: 2,
    two_hands: true,
    two_hands_basis: "tracks",
    difficulty: 3,
    difficulty_factors: [
      { key: "speed", label: "Speed", reading: "about 1.9 notes a second", weight: 0.41 },
    ],
    pitch_map: [[0, 76, 40, 1]],
    ...overrides,
  };
}

// One database for the file: the schema is created once (every call opens it
// idempotently), and each test works on rows it added itself.
setPlatform(memoryPlatform());

test("a fresh catalogue is empty", async () => {
  assert.equal(await countPieces(), 0);
  assert.deepEqual(await listPieces(), []);
});

test("insert round-trips every column, including the JSON ones", async () => {
  const saved = await insertPiece(piece());

  assert.ok(saved.id.length > 0, "the row gets an id");
  assert.ok(Date.parse(saved.created_at) > 0, "and a real timestamp");
  assert.equal(saved.title, "Für Elise");
  assert.equal(saved.difficulty, 3);
  assert.equal(saved.two_hands, true);
  assert.equal(saved.key_is_estimated, false);
  assert.equal(saved.practice_seconds, 0);
  assert.equal(saved.session_count, 0);
  // Booleans have to survive the integer column, both ways.
  assert.equal(saved.in_progress, false);
  assert.deepEqual(saved.difficulty_factors, [
    { key: "speed", label: "Speed", reading: "about 1.9 notes a second", weight: 0.41 },
  ]);
  assert.deepEqual(saved.pitch_map, [[0, 76, 40, 1]]);
});

test("the same bytes cannot be filed twice", async () => {
  // The previous test already filed this one.
  const duplicate = await findDuplicate("a".repeat(64));
  assert.equal(duplicate?.title, "Für Elise");

  let caught: unknown;
  try {
    await insertPiece(piece({ storage_path: "ccccccccdddddddd-other.mid" }));
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, "a second row with the same checksum must be refused");
  assert.equal(isUniqueViolation(caught), true, "and recognised as a duplicate, not a crash");
});

test("the whole truth is searchable, including the filename and the accents", async () => {
  await insertPiece(
    piece({
      title: "Gymnopédie No. 1",
      composer: "Satie",
      source_filename: "satie-gymnopedie-no-1.mid",
      checksum: "b".repeat(64),
      storage_path: "eeeeeeeeffffffff-satie.mid",
    }),
  );

  // Unaccented, the way somebody actually types it.
  const found = await listPieces("gymnopedie");
  assert.equal(found.length, 1);
  assert.equal(found[0].title, "Gymnopédie No. 1");

  // Two words, in any order across title and composer.
  assert.equal((await listPieces("satie no 1")).length, 1);
  assert.equal((await listPieces("chopin")).length, 0);
});

test("the user's layer is editable and the measured layer is not", async () => {
  const saved = await insertPiece(
    piece({
      title: "Minuet in G",
      composer: "Petzold",
      checksum: "c".repeat(64),
      storage_path: "1111111122222222-petzold.mid",
      difficulty: 2,
    }),
  );

  const updated = await updatePiece(saved.id, {
    is_favourite: true,
    notes: "bar 4 is the hard bit",
    session_count: 1,
    // Everything below is measured, and must be ignored rather than rejected:
    // a stale caller should not be able to rewrite the thing the app promises
    // it read from the file.
    difficulty: 5,
    note_count: 999,
    checksum: "d".repeat(64),
  });

  assert.equal(updated?.is_favourite, true);
  assert.equal(updated?.notes, "bar 4 is the hard bit");
  assert.equal(updated?.session_count, 1);
  assert.equal(updated?.difficulty, 2, "difficulty is measured, so it cannot be edited");
  assert.equal(updated?.note_count, 214, "and neither can anything else measured");
  assert.equal(updated?.checksum, "c".repeat(64));
});

test("patching a row that is not there says so instead of inventing one", async () => {
  assert.equal(await updatePiece("no-such-id", { is_favourite: true }), null);
});

test("removing returns the row, so the caller can remove its file too", async () => {
  const saved = await insertPiece(
    piece({
      title: "Ode to Joy",
      checksum: "e".repeat(64),
      storage_path: "3333333344444444-ode.mid",
    }),
  );

  const removed = await deletePiece(saved.id);
  assert.equal(removed?.title, "Ode to Joy");
  assert.equal(removed?.storage_path, "3333333344444444-ode.mid");
  assert.equal(await deletePiece(saved.id), null, "and deleting it twice is a no-op");
});
