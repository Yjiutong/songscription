/**
 * Writes the sample library as real .mid files.
 *
 * Every piece is a public-domain composition transcribed as actual notes, so
 * the app measures genuine data — key, tempo, range, polyphony, difficulty —
 * rather than being handed numbers somebody made up.
 *
 * These are whole pieces, not clips. Each one is written as named sections with
 * a `form` that plays them in the order the music actually goes, so "A A B A"
 * is a real repeat of a real section. An earlier version padded one phrase out
 * with `repeat: 11`, which made a two-minute file that said the same eight bars
 * eleven times and never reached its own ending.
 *
 * Two folders come out of this:
 *   src/assets/seed/  the library the app starts with, easiest to hardest
 *   public/demo/  files to drop in by hand, to show the upload path working
 *
 * Hands are real tracks. A piece with a left-hand part writes two tracks and
 * the app reads the hand from them; a piece written for the right hand alone
 * writes one, and the app says so. Both cases are in both folders on purpose.
 *
 *   node scripts/make-seed.mjs
 */

import { write } from "./engine.mjs";

/* -------------------------------------------------------------------------- *
 * Beginner: one hand, nothing stacked.
 * -------------------------------------------------------------------------- */

const twinkle = {
  where: "seed",
  file: "trad-twinkle-twinkle.mid",
  name: "Twinkle, Twinkle, Little Star",
  bpm: 100,
  timeSignature: [4, 4],
  key: { key: "C", scale: "major" },
  form: "A B B A",
  sections: {
    A: {
      right: `
        C4/4 C4/4 G4/4 G4/4   A4/4 A4/4 G4/2
        F4/4 F4/4 E4/4 E4/4   D4/4 D4/4 C4/2
      `,
    },
    B: { right: `G4/4 G4/4 F4/4 F4/4   E4/4 E4/4 D4/2` },
  },
};

const frereJacques = {
  where: "demo",
  file: "trad-frere-jacques.mid",
  name: "Frère Jacques",
  bpm: 104,
  timeSignature: [4, 4],
  key: { key: "C", scale: "major" },
  form: "A B A B",
  sections: {
    A: {
      right: `
        C4/4 D4/4 E4/4 C4/4   C4/4 D4/4 E4/4 C4/4
        E4/4 F4/4 G4/2        E4/4 F4/4 G4/2
      `,
    },
    B: {
      right: `
        G4/8 A4/8 G4/8 F4/8 E4/4 C4/4   G4/8 A4/8 G4/8 F4/8 E4/4 C4/4
        C4/4 G3/4 C4/2                  C4/4 G3/4 C4/2
      `,
    },
  },
};

const whenTheSaints = {
  where: "demo",
  file: "trad-when-the-saints.mid",
  name: "When the Saints Go Marching In",
  bpm: 112,
  timeSignature: [4, 4],
  key: { key: "C", scale: "major" },
  form: "A B A B",
  sections: {
    A: {
      right: `
        R/4 C4/4 E4/4 F4/4   G4/1
        R/4 C4/4 E4/4 F4/4   G4/1
        R/4 C4/4 E4/4 F4/4   G4/2 E4/2
        C4/2 E4/2            D4/1
      `,
    },
    B: {
      right: `
        R/4 E4/4 E4/4 D4/4   C4/2 C4/4 E4/4
        G4/2. G4/4           F4/1
        E4/2 F4/4 E4/4       D4/2 C4/4 C4/4
        D4/2 G3/2            C4/1
      `,
    },
  },
};

const amazingGrace = {
  where: "seed",
  file: "trad-amazing-grace.mid",
  name: "Amazing Grace",
  bpm: 76,
  timeSignature: [3, 4],
  key: { key: "G", scale: "major" },
  form: "A B A B",
  sections: {
    A: {
      right: `
        R/2 D4/4          G4/2 B4/8 G4/8   B4/2 A4/4   G4/2 E4/4
        D4/2.             R/2 D4/4         G4/2 B4/8 G4/8   B4/2 A4/4
      `,
    },
    B: {
      right: `
        D5/2.       D5/2 D5/4   G5/2 D5/8 B4/8   B4/2 G4/4
        A4/2 B4/4   G4/2 E4/4   D4/2.            G4/2.
      `,
    },
  },
};

/* -------------------------------------------------------------------------- *
 * Two hands, the left mostly holding.
 * -------------------------------------------------------------------------- */

const odeToJoy = {
  where: "seed",
  file: "beethoven-ode-to-joy.mid",
  name: "Ode to Joy",
  composerHint: "Ludwig van Beethoven",
  bpm: 108,
  timeSignature: [4, 4],
  key: { key: "C", scale: "major" },
  form: "A B C B",
  sections: {
    A: {
      right: `
        E4/4 E4/4 F4/4 G4/4   G4/4 F4/4 E4/4 D4/4
        C4/4 C4/4 D4/4 E4/4   E4/4. D4/8 D4/2
      `,
      left: [
        ["1", "C3", "G3"],
        ["1", "C3", "G3"],
        ["1", "A2", "E3"],
        ["1", "G2", "D3"],
      ],
    },
    B: {
      right: `
        E4/4 E4/4 F4/4 G4/4   G4/4 F4/4 E4/4 D4/4
        C4/4 C4/4 D4/4 E4/4   D4/4. C4/8 C4/2
      `,
      left: [
        ["1", "C3", "G3"],
        ["1", "C3", "G3"],
        ["1", "F2", "C3"],
        ["1", "C3", "G3"],
      ],
    },
    C: {
      right: `
        D4/4 D4/4 E4/4 C4/4          D4/4 E4/8 F4/8 E4/4 C4/4
        D4/4 E4/8 F4/8 E4/4 D4/4     C4/4 D4/4 G3/2
      `,
      left: [
        ["1", "G2", "D3"],
        ["1", "C3", "G3"],
        ["1", "G2", "D3"],
        ["1", "C3", "G3"],
      ],
    },
  },
};

const silentNight = {
  where: "seed",
  file: "gruber-silent-night.mid",
  name: "Silent Night",
  composerHint: "Franz Gruber",
  bpm: 68,
  timeSignature: [3, 4],
  key: { key: "C", scale: "major" },
  form: "A A B C D E",
  sections: {
    A: {
      right: `G4/4. A4/8 G4/4   E4/2.   G4/4. A4/8 G4/4   E4/2.`,
      left: [
        ["2.", "C3", "G3"],
        ["2.", "C3", "G3"],
        ["2.", "C3", "G3"],
        ["2.", "C3", "G3"],
      ],
    },
    B: {
      right: `D5/2 D5/4   B4/2.   C5/2 C5/4   G4/2.`,
      left: [
        ["2.", "G2", "D3"],
        ["2.", "G2", "D3"],
        ["2.", "C3", "G3"],
        ["2.", "C3", "G3"],
      ],
    },
    C: {
      right: `A4/2 A4/4   C5/4. B4/8 A4/4   G4/4. A4/8 G4/4   E4/2.`,
      left: [
        ["2.", "F2", "C3"],
        ["2.", "F2", "C3"],
        ["2.", "C3", "G3"],
        ["2.", "C3", "G3"],
      ],
    },
    D: {
      right: `D5/2 D5/4   F5/2 D5/4   C5/2.   G4/2 E4/4`,
      left: [
        ["2.", "G2", "D3"],
        ["2.", "G2", "D3"],
        ["2.", "C3", "G3"],
        ["2.", "C3", "G3"],
      ],
    },
    E: {
      right: `G4/4. F4/8 D4/4   C4/2.   C4/2.   R/2.`,
      left: [
        ["2.", "G2", "D3"],
        ["2.", "C3", "G3"],
        ["2.", "C3", "G3"],
        ["2.", "C3", "G3"],
      ],
    },
  },
};

const scarboroughFair = {
  where: "demo",
  file: "trad-scarborough-fair.mid",
  name: "Scarborough Fair",
  bpm: 96,
  timeSignature: [3, 4],
  // No key signature written: the estimator has to work it out, and this one is
  // modal, which is the interesting case to show.
  form: "A B A B",
  sections: {
    A: {
      right: `
        R/2 A4/4         A4/2 A4/4   E5/2 E5/4        E5/2 B4/4
        C5/4 B4/4 A4/4   B4/2.       R/2 A4/4         A4/4 C5/4 D5/4
      `,
      left: [
        ["2.", "R"],
        ["2.", "A2", "E3"],
        ["2.", "A2", "E3"],
        ["2.", "G2", "D3"],
        ["2.", "A2", "E3"],
        ["2.", "B2", "F#3"],
        ["2.", "R"],
        ["2.", "A2", "E3"],
      ],
    },
    B: {
      right: `
        E5/2 C5/4        A4/2 A4/4   G4/4 E4/4 G4/4   A4/2.
        A4/2 A4/4        E5/2 E5/4   D5/2 C5/4        A4/2.
      `,
      left: [
        ["2.", "C3", "G3"],
        ["2.", "A2", "E3"],
        ["2.", "G2", "D3"],
        ["2.", "A2", "E3"],
        ["2.", "A2", "E3"],
        ["2.", "G2", "D3"],
        ["2.", "D3", "A3"],
        ["2.", "A2", "E3"],
      ],
    },
  },
};

/* -------------------------------------------------------------------------- *
 * Two hands, both working.
 * -------------------------------------------------------------------------- */

const minuetInG = {
  where: "seed",
  file: "petzold-minuet-in-g.mid",
  name: "Minuet in G",
  composerHint: "Christian Petzold",
  bpm: 120,
  timeSignature: [3, 4],
  key: { key: "G", scale: "major" },
  // Both halves repeat, which is what the score says and what makes it a
  // minuet rather than sixteen bars that stop.
  form: "A A B B",
  sections: {
    A: {
      right: `
        D5/4 G4/8 A4/8 B4/8 C5/8    D5/4 G4/4 G4/4
        E5/4 C5/8 D5/8 E5/8 F#5/8   G5/4 G4/4 G4/4
        C5/4 D5/8 C5/8 B4/8 A4/8    B4/4 C5/8 B4/8 A4/8 G4/8
        F#4/4 G4/8 A4/8 B4/8 G4/8   A4/2.
        D5/4 G4/8 A4/8 B4/8 C5/8    D5/4 G4/4 G4/4
        E5/4 C5/8 D5/8 E5/8 F#5/8   G5/4 G4/4 G4/4
        C5/4 D5/8 C5/8 B4/8 A4/8    B4/4 C5/8 B4/8 A4/8 G4/8
        A4/4 B4/8 A4/8 G4/8 F#4/8   G4/2.
      `,
      left: [
        ["2.", "G2", "D3"], ["2.", "G2", "B2"], ["2.", "C3", "G3"], ["2.", "B2", "D3"],
        ["2.", "C3", "E3"], ["2.", "G2", "D3"], ["2.", "D3", "A3"], ["2.", "G2", "D3"],
        ["2.", "G2", "D3"], ["2.", "G2", "B2"], ["2.", "C3", "G3"], ["2.", "B2", "D3"],
        ["2.", "C3", "E3"], ["2.", "G2", "D3"], ["2.", "D3", "A3"], ["2.", "G2", "D3"],
      ],
    },
    B: {
      right: `
        B4/4 G5/8 F#5/8 G5/8 E5/8   F#5/4 G4/4 G4/4
        A4/4 B4/8 C5/8 B4/8 A4/8    B4/4 G4/4 G4/4
        A4/4 B4/8 C5/8 B4/8 A4/8    G4/4 A4/8 B4/8 A4/8 G4/8
        F#4/4 G4/8 A4/8 B4/8 G4/8   A4/2.
        B4/4 G5/8 F#5/8 G5/8 E5/8   F#5/4 G4/4 G4/4
        A4/4 B4/8 C5/8 B4/8 A4/8    B4/4 G4/4 G4/4
        A4/4 B4/8 C5/8 B4/8 A4/8    D5/4 C5/8 B4/8 A4/8 G4/8
        F#4/4 G4/8 A4/8 B4/8 G4/8   G4/2.
      `,
      left: [
        ["2.", "G2", "D3"], ["2.", "D3", "A3"], ["2.", "D3", "F#3"], ["2.", "G2", "D3"],
        ["2.", "D3", "F#3"], ["2.", "G2", "D3"], ["2.", "D3", "A3"], ["2.", "G2", "D3"],
        ["2.", "G2", "D3"], ["2.", "D3", "A3"], ["2.", "D3", "F#3"], ["2.", "G2", "D3"],
        ["2.", "D3", "F#3"], ["2.", "G2", "D3"], ["2.", "D3", "A3"], ["2.", "G2", "D3"],
      ],
    },
  },
};

// Pachelbel's ground: the same eight chords under every variation, which is the
// whole idea of the piece.
const GROUND = [
  ["2", "D3", "A3"], ["2", "A2", "E3"], ["2", "B2", "F#3"], ["2", "F#2", "C#3"],
  ["2", "G2", "D3"], ["2", "D2", "A2"], ["2", "G2", "D3"], ["2", "A2", "E3"],
];

const canonInD = {
  where: "seed",
  file: "pachelbel-canon-in-d.mid",
  name: "Canon in D",
  composerHint: "Johann Pachelbel",
  bpm: 64,
  timeSignature: [4, 4],
  key: { key: "D", scale: "major" },
  // The variations build and then recede. V5, the running-sixteenths one, is
  // left for the version a keener player would reach for.
  form: "V1 V2 V3 V4 V3 V2 V1",
  sections: {
    V1: { right: `F#5/2 E5/2   D5/2 C#5/2   B4/2 A4/2   B4/2 C#5/2`, left: GROUND },
    V2: { right: `D5/2 C#5/2   B4/2 A4/2   G4/2 F#4/2   G4/2 E4/2`, left: GROUND },
    V3: {
      right: `
        F#5/4 E5/4 D5/4 C#5/4   B4/4 A4/4 B4/4 C#5/4
        D5/4 C#5/4 B4/4 A4/4    G4/4 F#4/4 G4/4 E4/4
      `,
      left: GROUND,
    },
    V4: {
      right: `
        F#5/8 E5/8 F#5/8 G5/8 A5/8 G5/8 F#5/8 E5/8
        D5/8 C#5/8 D5/8 E5/8 F#5/8 E5/8 D5/8 C#5/8
        B4/8 A4/8 B4/8 C#5/8 D5/8 C#5/8 B4/8 A4/8
        B4/8 C#5/8 D5/8 E5/8 F#5/8 G5/8 A5/8 B5/8
      `,
      left: GROUND,
    },
    V5: {
      right: `
        A5/8 G5/8 F#5/8 E5/8 D5/8 C#5/8 B4/8 A4/8
        B4/8 C#5/8 D5/8 E5/8 F#5/8 G5/8 A5/8 F#5/8
        G5/8 F#5/8 E5/8 D5/8 C#5/8 B4/8 A4/8 G4/8
        A4/8 B4/8 C#5/8 D5/8 E5/8 F#5/8 G5/8 A5/8
      `,
      left: GROUND,
    },
  },
};

const greensleeves = {
  where: "seed",
  file: "trad-greensleeves.mid",
  name: "Greensleeves",
  bpm: 92,
  timeSignature: [6, 8],
  form: "A B A B",
  sections: {
    A: {
      right: `
        R/4. C5/4 D5/8        E5/4 F5/8 E5/4 D5/8
        B4/4 G4/8 A4/4 B4/8   C5/4 A4/8 A4/4 G#4/8
        A4/4 B4/8 G#4/4 E4/8  E4/2.
        R/4. C5/4 D5/8        E5/4 F5/8 E5/4 D5/8
      `,
      left: [
        ["2.", "A2", "E3"], ["2.", "A2", "E3"], ["2.", "G2", "D3"], ["2.", "G2", "D3"],
        ["2.", "A2", "E3"], ["2.", "E2", "B2"], ["2.", "A2", "E3"], ["2.", "A2", "E3"],
      ],
    },
    B: {
      right: `
        G5/2.                 F5/4 D5/8 B4/4 G4/8
        A4/4 B4/8 C5/4 A4/8   A4/4 G#4/8 A4/4 B4/8
        G5/2.                 F5/4 D5/8 B4/4 G4/8
        A4/4 B4/8 C5/4 A4/8   A4/2.
      `,
      left: [
        ["2.", "C3", "G3"], ["2.", "G2", "D3"], ["2.", "A2", "E3"], ["2.", "E2", "B2"],
        ["2.", "C3", "G3"], ["2.", "G2", "D3"], ["2.", "A2", "E3"], ["2.", "A2", "E3"],
      ],
    },
  },
};

// Satie's accompaniment: a bass note on one, the chord across two and three,
// the same shape every bar.
const GYMNO_G = [["4", "G2"], ["2", "B3", "D4", "F#4"]];
const GYMNO_D = [["4", "D3"], ["2", "A3", "C#4", "F#4"]];
const GYMNO_E = [["4", "E3"], ["2", "B3", "D4", "G4"]];
const GYMNO_A = [["4", "A2"], ["2", "A3", "C#4", "E4"]];

const gymnopedie = {
  where: "demo",
  file: "satie-gymnopedie-no-1.mid",
  name: "Gymnopédie No. 1",
  composerHint: "Erik Satie",
  bpm: 60,
  timeSignature: [3, 4],
  // The left hand plays four bars alone before the tune arrives, which is a
  // good test of a picture that claims to show which hand does what.
  form: "A B A C",
  sections: {
    A: {
      right: `
        R/2. R/2. R/2. R/2.
        F#5/2.   A5/4 G#5/4 F#5/4   C#5/2.   D5/2.
      `,
      left: [
        ...GYMNO_G, ...GYMNO_D, ...GYMNO_G, ...GYMNO_D,
        ...GYMNO_G, ...GYMNO_D, ...GYMNO_G, ...GYMNO_D,
      ],
    },
    B: {
      right: `
        A4/2.    B4/4 C#5/4 D5/4    C#5/2.   B4/2.
        F#5/2.   A5/4 G#5/4 F#5/4   E5/2.    D5/2.
      `,
      left: [
        ...GYMNO_G, ...GYMNO_D, ...GYMNO_E, ...GYMNO_A,
        ...GYMNO_G, ...GYMNO_D, ...GYMNO_G, ...GYMNO_D,
      ],
    },
    C: {
      right: `
        C#5/2.   D5/4 C#5/4 B4/4    A4/2.    G#4/2.
        A4/2.    B4/4 C#5/4 D5/4    C#5/2.   R/2.
      `,
      left: [
        ...GYMNO_E, ...GYMNO_A, ...GYMNO_E, ...GYMNO_A,
        ...GYMNO_G, ...GYMNO_D, ...GYMNO_G, ...GYMNO_G,
      ],
    },
  },
};

const preludeInC = {
  where: "demo",
  file: "bach-prelude-in-c.mid",
  name: "Prelude in C",
  composerHint: "J.S. Bach",
  bpm: 66,
  timeSignature: [4, 4],
  key: { key: "C", scale: "major" },
  // BWV 846: one harmony a bar, the figure played twice. The left hand takes
  // the two lowest notes and then holds off for the rest of the bar.
  form: "P1 P2 P3 P4 P1 P2",
  sections: {
    P1: {
      right: `
        R/4 G4/8 C5/8 E5/8 G4/8 C5/8 E5/8   R/4 A4/8 D5/8 F5/8 A4/8 D5/8 F5/8
        R/4 G4/8 D5/8 F5/8 G4/8 D5/8 F5/8   R/4 G4/8 C5/8 E5/8 G4/8 C5/8 E5/8
      `,
      left: `C3/8 E3/8 R/2.   C3/8 D3/8 R/2.   B2/8 D3/8 R/2.   C3/8 E3/8 R/2.`,
    },
    P2: {
      right: `
        R/4 A4/8 E5/8 A5/8 A4/8 E5/8 A5/8      R/4 F#4/8 A4/8 D5/8 F#4/8 A4/8 D5/8
        R/4 G4/8 D5/8 G5/8 G4/8 D5/8 G5/8      R/4 G4/8 C5/8 E5/8 G4/8 C5/8 E5/8
      `,
      left: `C3/8 E3/8 R/2.   C3/8 D3/8 R/2.   B2/8 D3/8 R/2.   B2/8 C3/8 R/2.`,
    },
    P3: {
      right: `
        R/4 E4/8 A4/8 C5/8 E4/8 A4/8 C5/8   R/4 A4/8 D5/8 F5/8 A4/8 D5/8 F5/8
        R/4 D4/8 G4/8 B4/8 D4/8 G4/8 B4/8   R/4 G4/8 C5/8 E5/8 G4/8 C5/8 E5/8
      `,
      left: `A2/8 C3/8 R/2.   D3/8 F#3/8 R/2.   G2/8 B2/8 R/2.   G2/8 C3/8 R/2.`,
    },
    P4: {
      right: `
        R/4 F4/8 A4/8 C5/8 F4/8 A4/8 C5/8      R/4 F#4/8 C5/8 D5/8 F#4/8 C5/8 D5/8
        R/4 G4/8 B4/8 D5/8 G4/8 B4/8 D5/8      R/4 G4/8 C5/8 E5/8 G4/8 C5/8 E5/8
      `,
      left: `F2/8 A2/8 R/2.   F2/8 A2/8 R/2.   G2/8 B2/8 R/2.   G2/8 C3/8 R/2.`,
    },
  },
};

/* -------------------------------------------------------------------------- *
 * The hard end.
 * -------------------------------------------------------------------------- */

const entertainer = {
  where: "demo",
  file: "joplin-the-entertainer.mid",
  name: "The Entertainer",
  composerHint: "Scott Joplin",
  bpm: 100,
  timeSignature: [2, 4],
  key: { key: "C", scale: "major" },
  form: "A A B B A",
  sections: {
    A: {
      right: `
        D5/8 E5/8 C5/8 A4/8   B4/8 G4/8 A4/8 C5/8
        D5/8 E5/8 C5/8 A4/8   B4/4 R/4
        D5/8 E5/8 C5/8 A4/8   B4/8 G4/8 A4/8 C5/8
        D5/8 E5/8 C5/8 A4/8   G4/4 R/4
      `,
      left: [
        ["4", "C2"], ["4", "E3", "G3", "C4"],
        ["4", "G2"], ["4", "D3", "G3", "B3"],
        ["4", "C2"], ["4", "E3", "G3", "C4"],
        ["4", "G2"], ["4", "D3", "G3", "B3"],
        ["4", "C2"], ["4", "E3", "G3", "C4"],
        ["4", "G2"], ["4", "D3", "G3", "B3"],
        ["4", "C2"], ["4", "E3", "G3", "C4"],
        ["4", "G2"], ["4", "D3", "G3", "B3"],
      ],
    },
    B: {
      right: `
        C5/8 D5/8 E5/8 C5/8   D5/8 E5/8 F5/8 D5/8
        E5/8 F5/8 G5/8 E5/8   C5/4 R/4
        A4/8 B4/8 C5/8 A4/8   B4/8 C5/8 D5/8 B4/8
        C5/8 D5/8 E5/8 C5/8   A4/4 R/4
      `,
      left: [
        ["4", "C2"], ["4", "E3", "G3", "C4"],
        ["4", "F2"], ["4", "F3", "A3", "C4"],
        ["4", "C2"], ["4", "E3", "G3", "C4"],
        ["4", "G2"], ["4", "D3", "G3", "B3"],
        ["4", "F2"], ["4", "F3", "A3", "C4"],
        ["4", "G2"], ["4", "D3", "G3", "B3"],
        ["4", "C2"], ["4", "E3", "G3", "C4"],
        ["4", "A2"], ["4", "E3", "A3", "C4"],
      ],
    },
  },
};

const furElise = {
  where: "seed",
  file: "beethoven-fur-elise.mid",
  name: "Für Elise",
  composerHint: "Ludwig van Beethoven",
  bpm: 72,
  timeSignature: [3, 8],
  // The rondo it actually is: the theme keeps coming back between episodes.
  form: "A A B A A C A A B A",
  sections: {
    A: {
      right: `
        E5/16 D#5/16 E5/16 B4/16 D5/16 C5/16
        A4/8 R/16 C4/16 E4/16 A4/16
        B4/8 R/16 E4/16 G#4/16 B4/16
        C5/8 R/16 E4/16 E5/16 D#5/16
        E5/16 D#5/16 E5/16 B4/16 D5/16 C5/16
        A4/8 R/16 C4/16 E4/16 A4/16
        B4/8 R/16 E4/16 C5/16 B4/16
        A4/4.
      `,
      left: `
        R/4.
        A2/16 E3/16 A3/16 R/8.
        E2/16 E3/16 G#3/16 R/8.
        A2/16 E3/16 A3/16 R/8.
        R/4.
        A2/16 E3/16 A3/16 R/8.
        E2/16 E3/16 G#3/16 R/8.
        A2/16 E3/16 A3/16 R/8.
      `,
    },
    // The F major episode.
    B: {
      right: `
        C5/8 R/16 F4/16 A4/16 C5/16
        F5/8 R/16 F4/16 A4/16 C5/16
        E5/16 D5/16 C5/16 B4/16 A4/16 G4/16
        F4/8 R/16 F4/16 A4/16 C5/16
        C5/8 R/16 G4/16 C5/16 E5/16
        G5/8 R/16 G4/16 C5/16 E5/16
        F5/16 E5/16 D5/16 C5/16 B4/16 A4/16
        G4/4.
      `,
      left: `
        F2/16 C3/16 F3/16 R/8.
        F2/16 C3/16 F3/16 R/8.
        C3/16 G3/16 C4/16 R/8.
        F2/16 C3/16 F3/16 R/8.
        C3/16 G3/16 C4/16 R/8.
        C3/16 G3/16 C4/16 R/8.
        G2/16 D3/16 G3/16 R/8.
        C3/4.
      `,
    },
    // The stormy one, further from home.
    C: {
      right: `
        C5/16 D5/16 E5/16 F5/16 G5/16 A5/16
        B5/8 R/16 A5/16 G5/16 F5/16
        E5/16 F5/16 G5/16 A5/16 B5/16 C6/16
        D6/8 R/16 C6/16 B5/16 A5/16
        G5/16 F5/16 E5/16 D5/16 C5/16 B4/16
        A4/8 R/16 C4/16 E4/16 A4/16
        B4/8 R/16 E4/16 G#4/16 B4/16
        E5/4.
      `,
      left: `
        A2/16 E3/16 A3/16 R/8.
        D2/16 A2/16 D3/16 R/8.
        G2/16 D3/16 G3/16 R/8.
        G2/16 D3/16 G3/16 R/8.
        C3/16 G3/16 C4/16 R/8.
        A2/16 E3/16 A3/16 R/8.
        E2/16 E3/16 G#3/16 R/8.
        E2/4.
      `,
    },
  },
};

const moonlight = {
  where: "seed",
  file: "beethoven-moonlight-sonata.mid",
  name: "Moonlight Sonata",
  composerHint: "Ludwig van Beethoven",
  bpm: 54,
  timeSignature: [4, 4],
  // Op. 27 No. 2, first movement: an unbroken triplet figure over a slowly
  // changing harmony, which is why the right hand never gets a rest and why it
  // sits where it does on the difficulty scale.
  form: "S1 S2 S3 S4 S1 S5 S6 S4 S1 S2",
  sections: {
    S1: {
      right: `
        G#3/8t C#4/8t E4/8t  G#3/8t C#4/8t E4/8t  G#3/8t C#4/8t E4/8t  G#3/8t C#4/8t E4/8t
        G#3/8t C#4/8t E4/8t  G#3/8t C#4/8t E4/8t  G#3/8t C#4/8t E4/8t  G#3/8t C#4/8t E4/8t
        G#3/8t C#4/8t E4/8t  G#3/8t C#4/8t E4/8t  G#3/8t C#4/8t E4/8t  G#3/8t C#4/8t E4/8t
        G#3/8t C#4/8t E4/8t  G#3/8t C#4/8t E4/8t  G#3/8t C#4/8t E4/8t  G#3/8t C#4/8t E4/8t
      `,
      left: [["1", "C#2", "C#3"], ["1", "C#2", "C#3"], ["1", "C#2", "C#3"], ["1", "C#2", "C#3"]],
    },
    S2: {
      right: `
        A3/8t C#4/8t E4/8t   A3/8t C#4/8t E4/8t   A3/8t C#4/8t E4/8t   A3/8t C#4/8t E4/8t
        A3/8t D4/8t F#4/8t   A3/8t D4/8t F#4/8t   A3/8t D4/8t F#4/8t   A3/8t D4/8t F#4/8t
        G#3/8t B#3/8t F#4/8t G#3/8t B#3/8t F#4/8t G#3/8t C#4/8t E4/8t  G#3/8t C#4/8t E4/8t
        G#3/8t C#4/8t E4/8t  G#3/8t C#4/8t E4/8t  G#3/8t C#4/8t E4/8t  G#3/8t C#4/8t E4/8t
      `,
      left: [["1", "A1", "A2"], ["1", "F#1", "F#2"], ["1", "G#1", "G#2"], ["1", "C#2", "C#3"]],
    },
    S3: {
      right: `
        F#3/8t A3/8t D4/8t   F#3/8t A3/8t D4/8t   F#3/8t A3/8t D4/8t   F#3/8t A3/8t D4/8t
        G#3/8t B3/8t E4/8t   G#3/8t B3/8t E4/8t   G#3/8t B3/8t E4/8t   G#3/8t B3/8t E4/8t
        A3/8t C#4/8t E4/8t   A3/8t C#4/8t E4/8t   A3/8t C#4/8t E4/8t   A3/8t C#4/8t E4/8t
        G#3/8t B3/8t E4/8t   G#3/8t B3/8t E4/8t   G#3/8t B3/8t D#4/8t G#3/8t B3/8t D#4/8t
      `,
      left: [["1", "D2", "D3"], ["1", "E2", "E3"], ["1", "A1", "A2"], ["1", "E2", "E3"]],
    },
    S4: {
      right: `
        E3/8t G#3/8t B3/8t   E3/8t G#3/8t B3/8t   E3/8t G#3/8t B3/8t   E3/8t G#3/8t B3/8t
        E3/8t A3/8t C#4/8t   E3/8t A3/8t C#4/8t   E3/8t A3/8t C#4/8t   E3/8t A3/8t C#4/8t
        D#3/8t F#3/8t B3/8t  D#3/8t F#3/8t B3/8t  D#3/8t F#3/8t B3/8t  D#3/8t F#3/8t B3/8t
        E3/8t G#3/8t B3/8t   E3/8t G#3/8t B3/8t   E3/8t G#3/8t B3/8t   E3/8t G#3/8t B3/8t
      `,
      left: [["1", "E2", "E3"], ["1", "A1", "A2"], ["1", "B1", "B2"], ["1", "E2", "E3"]],
    },
    S5: {
      right: `
        F#3/8t A3/8t C#4/8t  F#3/8t A3/8t C#4/8t  F#3/8t A3/8t C#4/8t  F#3/8t A3/8t C#4/8t
        F#3/8t A3/8t D4/8t   F#3/8t A3/8t D4/8t   F#3/8t A3/8t D4/8t   F#3/8t A3/8t D4/8t
        G#3/8t B3/8t E4/8t   G#3/8t B3/8t E4/8t   G#3/8t B3/8t E4/8t   G#3/8t B3/8t E4/8t
        G#3/8t C#4/8t E4/8t  G#3/8t C#4/8t E4/8t  G#3/8t C#4/8t E4/8t  G#3/8t C#4/8t E4/8t
      `,
      left: [["1", "F#1", "F#2"], ["1", "D2", "D3"], ["1", "E2", "E3"], ["1", "C#2", "C#3"]],
    },
    S6: {
      right: `
        B#2/8t F#3/8t A3/8t  B#2/8t F#3/8t A3/8t  B#2/8t F#3/8t A3/8t  B#2/8t F#3/8t A3/8t
        C#3/8t E3/8t G#3/8t  C#3/8t E3/8t G#3/8t  C#3/8t E3/8t G#3/8t  C#3/8t E3/8t G#3/8t
        A2/8t E3/8t A3/8t    A2/8t E3/8t A3/8t    A2/8t E3/8t A3/8t    A2/8t E3/8t A3/8t
        G#2/8t D#3/8t F#3/8t G#2/8t D#3/8t F#3/8t G#2/8t D#3/8t F#3/8t G#2/8t D#3/8t F#3/8t
      `,
      left: [["1", "G#1", "G#2"], ["1", "C#2", "C#3"], ["1", "A1", "A2"], ["1", "G#1", "G#2"]],
    },
  },
};

const bumblebee = {
  where: "demo",
  file: "rimsky-korsakov-flight-of-the-bumblebee.mid",
  name: "Flight of the Bumblebee",
  composerHint: "Nikolai Rimsky-Korsakov",
  bpm: 140,
  timeSignature: [2, 4],
  // Chromatic sixteenths at speed: nearly half the notes are black keys and
  // nothing repeats, which is what the top of the difficulty scale is for.
  form: "A B C B A B C D",
  sections: {
    A: {
      right: `
        A5/16 G#5/16 G5/16 F#5/16   F5/16 E5/16 D#5/16 D5/16
        C#5/16 C5/16 B4/16 A#4/16   A4/16 G#4/16 G4/16 F#4/16
        F4/16 E4/16 D#4/16 D4/16    C#4/16 D4/16 D#4/16 E4/16
        F4/16 F#4/16 G4/16 G#4/16   A4/16 A#4/16 B4/16 C5/16
      `,
      left: [
        ["4", "R"], ["4", "A2", "E3"],
        ["4", "R"], ["4", "A2", "E3"],
        ["4", "R"], ["4", "D3", "A3"],
        ["4", "R"], ["4", "E3", "B3"],
      ],
    },
    B: {
      right: `
        C#5/16 D5/16 D#5/16 E5/16   F5/16 F#5/16 G5/16 G#5/16
        A5/16 A#5/16 B5/16 C6/16    C#6/16 C6/16 B5/16 A#5/16
        A5/16 G#5/16 G5/16 F#5/16   F5/16 E5/16 D#5/16 D5/16
        C#5/16 C5/16 B4/16 A#4/16   A4/16 G#4/16 G4/16 F#4/16
      `,
      left: [
        ["4", "R"], ["4", "A2", "E3"],
        ["4", "R"], ["4", "F2", "C3"],
        ["4", "R"], ["4", "E2", "B2"],
        ["4", "R"], ["4", "A2", "E3"],
      ],
    },
    C: {
      right: `
        E4/16 F4/16 F#4/16 G4/16    G#4/16 A4/16 A#4/16 B4/16
        C5/16 C#5/16 D5/16 D#5/16   E5/16 F5/16 F#5/16 G5/16
        G#5/16 A5/16 G#5/16 G5/16   F#5/16 F5/16 E5/16 D#5/16
        D5/16 C#5/16 C5/16 B4/16    A#4/16 A4/16 G#4/16 G4/16
      `,
      left: [
        ["4", "R"], ["4", "E2", "B2"],
        ["4", "R"], ["4", "E2", "B2"],
        ["4", "R"], ["4", "A2", "E3"],
        ["4", "R"], ["4", "A2", "E3"],
      ],
    },
    D: {
      right: `
        F#4/16 G4/16 G#4/16 A4/16   A#4/16 B4/16 C5/16 C#5/16
        D5/16 D#5/16 E5/16 F5/16    F#5/16 G5/16 G#5/16 A5/16
        A5/16 G#5/16 A5/16 G#5/16   A5/16 G#5/16 A5/16 G#5/16
        A5/4 R/4
      `,
      left: [
        ["4", "R"], ["4", "E2", "B2"],
        ["4", "R"], ["4", "E2", "B2"],
        ["4", "R"], ["4", "A2", "E3"],
        ["4", "A2", "E3"], ["4", "R"],
      ],
    },
  },
};

write(
  [
    twinkle,
    amazingGrace,
    odeToJoy,
    silentNight,
    minuetInG,
    canonInD,
    furElise,
    moonlight,
    frereJacques,
    whenTheSaints,
    scarboroughFair,
    greensleeves,
    gymnopedie,
    preludeInC,
    entertainer,
    bumblebee,
  ],
  ["seed", "demo"],
);
