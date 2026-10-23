/**
 * The bit that turns written music into a .mid file.
 *
 * A piece is a set of named sections and a form that says which order they play
 * in, so "A A B A" is a real repeat of a real section rather than one phrase
 * looped to pad the length out. Every section states both hands, and the writer
 * refuses a section whose hands do not cover the same number of beats — a hand
 * that runs short does not just end early, it plays the wrong harmony under
 * every bar after the point where it drifted.
 */

// @tonejs/midi ships CommonJS; take the default and destructure.
import midiPkg from "@tonejs/midi";
const { Midi } = midiPkg;
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";

const PITCH = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** "C4/4" quarter · "Eb5/8" eighth · "C4/2." dotted half · "G4/8t" triplet · "R/4" rest */
export function parse(token) {
  const match = /^([A-Ga-gR])([#b]?)(-?\d+)?\/(\d+)(\.?)(t?)$/.exec(token);
  if (!match) throw new Error(`bad token: ${token}`);
  const [, letter, accidental, octave, denom, dot, triplet] = match;
  let beats = 4 / Number(denom);
  if (dot) beats *= 1.5;
  if (triplet) beats *= 2 / 3;
  if (letter === "R") return { rest: true, beats };
  const semitone =
    PITCH[letter.toLowerCase()] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
  return { midi: (Number(octave) + 1) * 12 + semitone, beats };
}

/** A melody line: one note at a time, written as rhythm tokens. */
function melody(source, from, sustain = 0.92) {
  const events = [];
  let beat = from;
  for (const token of source.trim().split(/\s+/)) {
    const note = parse(token);
    if (!note.rest) {
      events.push({ midi: note.midi, beat, beats: note.beats * sustain, velocity: 0.8 });
    }
    beat += note.beats;
  }
  return { events, beats: beat - from };
}

/**
 * A chord voice: every pitch in a group sounds together.
 *
 * The rhythm is a note value in the same vocabulary the melody uses, so a bar
 * of 3/4 is "2." — writing it as a denominator is what silently cost every
 * waltz a beat a bar the first time round.
 */
function chords(groups, from) {
  const events = [];
  let beat = from;
  for (const [value, ...pitches] of groups) {
    const { beats } = parse(`R/${value}`);
    for (const pitch of pitches) {
      if (pitch !== "R") {
        events.push({ midi: parse(`${pitch}/4`).midi, beat, beats: beats * 0.95, velocity: 0.62 });
      }
    }
    beat += beats;
  }
  return { events, beats: beat - from };
}

function renderHand(part, from) {
  if (!part) return { events: [], beats: null };
  return Array.isArray(part) ? chords(part, from) : melody(part, from);
}

const near = (a, b) => Math.abs(a - b) < 1e-6;

/** Where each shelf is written. Seed ships inside the bundle; demo is for dropping by hand. */
function shelf(dir) {
  return dir === "seed"
    ? path.join(process.cwd(), "src", "assets", "seed")
    : path.join(process.cwd(), "public", dir);
}

export function write(pieces, roots) {
  for (const dir of roots) {
    const out = shelf(dir);
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
  }

  for (const piece of pieces) {
    const midi = new Midi();
    midi.name = piece.name;
    midi.header.setTempo(piece.bpm);
    midi.header.timeSignatures.push({ ticks: 0, timeSignature: piece.timeSignature, measures: 0 });
    // Deliberately left off some pieces so the key estimator has real work to do.
    if (piece.key) {
      midi.header.keySignatures.push({ ticks: 0, key: piece.key.key, scale: piece.key.scale });
    }

    const sections = piece.sections ?? { A: { right: piece.right, left: piece.left } };
    const form = (piece.form ?? "A").trim().split(/\s+/);

    const right = [];
    const left = [];
    let beat = 0;

    for (const name of form) {
      const section = sections[name];
      if (!section) throw new Error(`${piece.file}: the form names a section "${name}" that does not exist`);

      const r = renderHand(section.right, beat);
      const l = renderHand(section.left, beat);

      if (l.beats !== null && !near(r.beats, l.beats)) {
        throw new Error(
          `${piece.file}: section ${name} has ${r.beats} beats in the right hand and ` +
            `${l.beats} in the left. Both hands have to cover the same ground.`,
        );
      }
      const bar = piece.timeSignature[0] * (4 / piece.timeSignature[1]);
      if (piece.strictBars !== false && !near(r.beats % bar, 0) && !near(r.beats % bar, bar)) {
        throw new Error(
          `${piece.file}: section ${name} is ${r.beats} beats, which is not whole bars of ` +
            `${piece.timeSignature.join("/")}. Set strictBars: false if the section really ends mid-bar.`,
        );
      }

      right.push(...r.events);
      left.push(...l.events);
      beat += r.beats;
    }

    const secondsPerBeat = 60 / piece.bpm;
    const add = (name, events) => {
      if (events.length === 0) return;
      const track = midi.addTrack();
      track.name = name;
      for (const e of events) {
        track.addNote({
          midi: e.midi,
          time: e.beat * secondsPerBeat,
          duration: e.beats * secondsPerBeat,
          velocity: e.velocity,
        });
      }
    };
    add("Right hand", right);
    add("Left hand", left);

    const notes = right.length + left.length;
    writeFileSync(
      path.join(shelf(piece.where), piece.file),
      Buffer.from(midi.toArray()),
    );
    console.log(
      `${piece.where.padEnd(5)} ${piece.file.padEnd(38)} ${String(notes).padStart(5)}n ` +
        `${midi.duration.toFixed(0).padStart(4)}s ${String(form.length).padStart(3)} sections ` +
        `${left.length === 0 ? "right hand only" : "two hands"}`,
    );
  }
}
