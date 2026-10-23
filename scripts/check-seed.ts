import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { analyseMidi } from "../src/lib/midi.ts";

for (const dir of ["src/assets/seed", "public/demo"]) {
  console.log(`
== ${dir} ==`);
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".mid"))) {
    const b = readFileSync(path.join(dir, f));
    const a = analyseMidi(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, f);
    console.log(
      `${a.difficulty}  ${a.title.padEnd(32)} ${String(a.tempoBpm ?? "-").padStart(3)}bpm  ${(a.keySignature ?? "-").padEnd(9)}${a.keyIsEstimated ? "~" : " "} ${(a.timeSignature ?? "-").padEnd(4)} ${a.twoHands ? "2 hands" : "1 hand "}  ${String(a.noteCount).padStart(3)}n  poly${a.maxSimultaneousNotes}  ${a.durationSeconds.toFixed(0)}s`,
    );
  }
}
