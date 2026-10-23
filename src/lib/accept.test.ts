import { test } from "node:test";
import assert from "node:assert/strict";
import { checkFile, MAX_BYTES } from "./accept.ts";

/**
 * These rules run in two places — the browser, so a wrong file is refused
 * instantly, and the route handler, because the browser is not a trust
 * boundary. Both call this one function, so this is the whole contract.
 *
 *   npm test
 */

test("a plain .mid passes", () => {
  assert.equal(checkFile("beethoven-fur-elise.mid", 4_200), null);
  assert.equal(checkFile("Canon In D.MIDI", 900), null);
});

test("anything that is not MIDI is refused by name", () => {
  const wav = checkFile("take-three.wav", 40_000_000);
  assert.equal(wav?.status, 415);
  // The message names the file, because a batch drop produces several rows.
  assert.match(wav!.error, /take-three\.wav/);

  // A dropped folder arrives as a nameless zero-byte entry; it fails here
  // rather than at the "empty file" check, which would be the wrong advice.
  assert.equal(checkFile("My Transcriptions", 0)?.status, 415);
});

test("an empty file is refused before it is uploaded", () => {
  assert.equal(checkFile("silence.mid", 0)?.status, 400);
});

test("the size ceiling is inclusive of the limit itself", () => {
  assert.equal(checkFile("big.mid", MAX_BYTES), null);
  assert.equal(checkFile("big.mid", MAX_BYTES + 1)?.status, 413);
});

test("every rejection carries a detail line, never a bare error", () => {
  for (const [name, size] of [
    ["song.wav", 10],
    ["song.mid", 0],
    ["song.mid", MAX_BYTES + 1],
  ] as const) {
    const rejection = checkFile(name, size);
    assert.ok(rejection, `${name} at ${size} should be refused`);
    assert.ok(rejection.detail.length > 20, "the detail has to say what to do next");
  }
});
