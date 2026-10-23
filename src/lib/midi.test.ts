import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { analyseMidi, composerFromFilename, titleFromFilename } from "./midi.ts";
import { rangeInWords, reachInWords } from "./piece.ts";

/**
 * The analyser is the part of this app that would fail quietly: a broken
 * difficulty score still renders, it is just wrong, and it is wrong about the
 * one thing a learner is trusting it for. These run against the real sample
 * files rather than fixtures.
 *
 *   npm test
 */

// The seed shelf ships inside the bundle now, so the tests read it where it
// actually lives rather than where a server used to serve it from.
const SHELF: Record<string, string> = {
  seed: path.join("src", "assets", "seed"),
  demo: path.join("public", "demo"),
};

const from = (dir: string) => (name: string) => {
  const bytes = readFileSync(path.join(process.cwd(), SHELF[dir], name));
  return analyseMidi(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    name,
  );
};
const seed = from("seed");
const demo = from("demo");

const twinkle = seed("trad-twinkle-twinkle.mid");
const elise = seed("beethoven-fur-elise.mid");
const silentNight = seed("gruber-silent-night.mid");
const minuet = seed("petzold-minuet-in-g.mid");
const grace = seed("trad-amazing-grace.mid");
const greensleeves = seed("trad-greensleeves.mid");
const bumblebee = demo("rimsky-korsakov-flight-of-the-bumblebee.mid");

test("a one-hand nursery tune has no black keys and never stacks notes", () => {
  assert.equal(twinkle.blackKeyFraction, 0);
  assert.equal(twinkle.maxSimultaneousNotes, 1);
  assert.equal(twinkle.twoHands, false);
});

test("key estimation recovers the key the file does not declare", () => {
  assert.equal(twinkle.keySignature, "C major");
  // Für Elise is the canonical A minor test: the estimator has to prefer the
  // relative minor over C major, which shares every pitch class.
  assert.equal(elise.keySignature, "A minor");
});

test("Für Elise is harder than a nursery rhyme, and uses both hands", () => {
  assert.equal(elise.twoHands, true);
  assert.ok(
    elise.difficulty > twinkle.difficulty,
    `expected Für Elise (${elise.difficulty}) above Twinkle (${twinkle.difficulty})`,
  );
});

test("the key estimator gets a minor-key folk tune right", () => {
  // Regression: a left hand holding open fifths used to outvote the melody and
  // push this to A major. Every note's contribution is now capped.
  assert.equal(greensleeves.keySignature, "A minor");
  assert.equal(grace.keySignature, "G major");
});

test("a key signature event with no key falls back to estimation", () => {
  // Regression: trusting the event's presence rather than its contents printed
  // the literal string "undefined major" to the user.
  for (const piece of [greensleeves, silentNight, minuet, elise]) {
    assert.ok(piece.keySignature, "no key at all");
    assert.doesNotMatch(piece.keySignature!, /undefined/, piece.title);
  }
});

test("difficulty separates pieces instead of bunching them", () => {
  // Regression: averaging the factors put seven of twelve real pieces in the
  // same grade. Block chords under a slow tune must rate below a two-hand
  // dance, and both must rate below Für Elise.
  assert.ok(
    silentNight.difficulty < minuet.difficulty,
    `Silent Night ${silentNight.difficulty} should sit below Minuet ${minuet.difficulty}`,
  );
  assert.ok(
    minuet.difficulty < elise.difficulty,
    `Minuet ${minuet.difficulty} should sit below Für Elise ${elise.difficulty}`,
  );
  assert.equal(twinkle.difficulty, 1);
});

test("every difficulty is in range and every factor is a 0-1 weight", () => {
  for (const piece of [twinkle, elise, greensleeves, silentNight, minuet, bumblebee]) {
    assert.ok(piece.difficulty >= 1 && piece.difficulty <= 5, `difficulty ${piece.difficulty}`);
    assert.equal(piece.difficultyFactors.length, 5);
    for (const factor of piece.difficultyFactors) {
      assert.ok(factor.weight >= 0 && factor.weight <= 1, `${factor.key} weight ${factor.weight}`);
      assert.ok(factor.reading.length > 0, `${factor.key} has no reading`);
    }
  }
});

test("the pitch map stays inside the bounds the card draws it in", () => {
  for (const piece of [twinkle, twinkle, elise, greensleeves, minuet]) {
    assert.ok(piece.pitchMap.length > 0);
    for (const [start, midi, length] of piece.pitchMap) {
      assert.ok(start >= 0 && start <= 1000, `start ${start}`);
      assert.ok(length >= 1, `length ${length}`);
      assert.ok(
        midi >= piece.lowestNote && midi <= piece.highestNote,
        `note ${midi} outside ${piece.lowestNote}-${piece.highestNote}`,
      );
    }
  }
});

test("measured facts are self-consistent", () => {
  for (const piece of [twinkle, twinkle, elise, greensleeves, silentNight, minuet, grace]) {
    assert.ok(piece.highestNote >= piece.lowestNote);
    assert.ok(piece.distinctPitchCount <= piece.noteCount);
    assert.ok(piece.distinctPitchCount <= piece.highestNote - piece.lowestNote + 1);
    assert.ok(piece.durationSeconds > 0);
    assert.ok(piece.maxSimultaneousNotes >= 1);
  }
});

test("the keyboard span is one number, however it is phrased", () => {
  // Regression: midi.ts used highest - lowest and piece.ts used
  // highest - lowest + 1, so one page said 36 keys in one place and 37 in
  // another — on the page whose whole claim is that the figures are measured.
  for (const piece of [twinkle, twinkle, elise, greensleeves, silentNight, minuet, grace]) {
    const keys = piece.highestNote - piece.lowestNote + 1;
    const reach = piece.difficultyFactors.find((f) => f.key === "reach")!;
    assert.match(
      reach.reading,
      new RegExp(String.raw`\b${keys}\b`),
      `${piece.title}: ${reach.reading}`,
    );
    assert.match(
      rangeInWords(piece.lowestNote, piece.highestNote),
      new RegExp(`^88 个键里用到 ${keys} 个`),
      piece.title,
    );
    // ...and it can never claim to *use* more keys than it actually touches.
    assert.ok(piece.distinctPitchCount <= keys, piece.title);
  }
});

test("how far the hands reach is not understated", () => {
  // Regression: 37 of 88 keys is 42%, described as "about a third".
  assert.equal(reachInWords(40, 76), "接近半个键盘");
  assert.equal(reachInWords(60, 67), "键盘的一小块");
  assert.equal(reachInWords(21, 108), "几乎整个键盘");
});

test("filenames become titles, not the other way round", () => {
  assert.equal(titleFromFilename("beethoven-fur-elise.mid"), "Für Elise");
  assert.equal(composerFromFilename("beethoven-fur-elise.mid"), "Beethoven");
  assert.equal(composerFromFilename("twinkle-twinkle.mid"), null);
  assert.equal(titleFromFilename("trad-scarborough-fair.mid"), "Scarborough Fair");
  assert.equal(composerFromFilename("satie-gymnopedie-no-1.mid"), "Erik Satie");
  // the filename is the only metadata a transcription hand-off carries, so the
  // composer has to survive it
  assert.equal(composerFromFilename("gruber-silent-night.mid"), "Franz Gruber");
  assert.equal(composerFromFilename("trad-greensleeves.mid"), "Traditional");
  assert.equal(titleFromFilename("trad-greensleeves.mid"), "Greensleeves");
  assert.equal(titleFromFilename("gruber-silent-night.mid"), "Silent Night");
});

test("a file that is not MIDI is rejected rather than half-parsed", () => {
  const notMidi = new TextEncoder().encode("this is definitely not a midi file").buffer;
  assert.throws(() => analyseMidi(notMidi as ArrayBuffer, "fake.mid"));
});

test("the difficulty scale reaches both ends", () => {
  // The shelf is useless as a demonstration if everything on it grades the
  // same. Twinkle must sit at the floor and the bumblebee at the ceiling.
  assert.equal(twinkle.difficulty, 1);
  assert.equal(bumblebee.difficulty, 5);
});

test("hands come from the file's tracks, not from middle C", () => {
  // Moonlight's right-hand triplets sit across middle C, so a pitch split cut
  // every arpeggio in half and drew it as though both hands played it.
  const moonlight = seed("beethoven-moonlight-sonata.mid");
  const hands = new Set(moonlight.pitchMap.map(([, , , hand]) => hand));
  assert.deepEqual([...hands].sort(), [0, 1], "both hands should appear");

  // Moonlight's triplet figure starts on G#3, below middle C, and belongs to
  // the right hand. A pitch split called those notes the left hand and cut
  // every arpeggio in two.
  const lowRightHand = moonlight.pitchMap.filter(([, midi, , hand]) => midi < 60 && hand === 1);
  assert.ok(
    lowRightHand.length > 0,
    "notes below middle C should still be able to belong to the right hand",
  );

  // A file with one track has no hands to read, so it falls back to the split.
  assert.ok(twinkle.pitchMap.every(([, midi, , hand]) => hand === (midi >= 60 ? 1 : 0)));
});
