import assert from "node:assert/strict";
import test from "node:test";
import { buildScore, keyOf, parseTimeSignature, planScore, toCode } from "./notation";
import type { Note } from "./audio";

/**
 * 量化的测试。
 *
 * 这一段是整个功能里唯一"算错了看不出来"的部分：坏的值不会报错，只会画出一张
 * 位置不对的谱，而大多数人会以为是自己看错了。所以每个容错的边界都在一个数仙。
 */

function note(midi: number, time: number, duration: number, hand: 0 | 1 = 1): Note {
  return { midi, time, duration, velocity: 0.8, hand };
}

test("中央 C 写作 c/4", () => {
  assert.equal(keyOf(60), "c/4");
  assert.equal(keyOf(61), "c#/4");
  assert.equal(keyOf(69), "a/4");
  assert.equal(keyOf(48), "c/3");
});

test("拍号：认得出就认，认不出回落 4/4", () => {
  assert.deepEqual(parseTimeSignature("6/8"), [6, 8]);
  assert.deepEqual(parseTimeSignature(" 3 / 4 "), [3, 4]);
  assert.equal(parseTimeSignature("Allegro"), null);
  assert.equal(parseTimeSignature(null), null);
});

test("6/8 一小节是三个四分音符", () => {
  const score = planScore([note(60, 0, 0.5)], { bpm: 120, timeSignature: "6/8", twoHands: false });
  assert.equal(score.beatsPerMeasure, 3);
  assert.equal(score.numerator, 6);
  assert.equal(score.denominator, 8);
});

test("120 bpm 的四分音符就是一拍", () => {
  // 0.5 秒 = 一拍；四个连着排的小节第一拍各一个音
  const notes = [0, 0.5, 1, 1.5].map((t) => note(60, t, 0.5));
  const score = planScore(notes, { bpm: 120, timeSignature: "4/4", twoHands: false });

  assert.equal(score.measures.length, 1);
  assert.equal(score.hands, 1);
  assert.equal(score.measures[0].right.length, 4);
  for (const n of score.measures[0].right) {
    assert.equal(n.code, "q");
    assert.equal(n.dots, 0);
    assert.equal(n.rest, false);
  }
  assert.deepEqual(
    score.measures[0].right.map((n) => n.at),
    [0, 1, 2, 3],
  );
});

test("附点：1.5 拍写成四分音符加一个点", () => {
  const { code, dots, length } = toCode(1.5);
  assert.equal(code, "q");
  assert.equal(dots, 1);
  assert.equal(length, 1.5);
});

test("量化到最近的一格，而不会把短音变长一倍", () => {
  // 0.29 拍远更接近 0.25（十六分音符）而不是 0.5（八分音符）。
  const score = planScore([note(60, 0, 0.29 / 2)], {
    bpm: 120,
    timeSignature: "4/4",
    twoHands: false,
  });
  const note_ = score.measures[0].right[0];
  assert.equal(note_.length, 0.25);
  assert.equal(note_.code, "16");
});

test("跨小节的音被切开，后半落到下一小节头上", () => {
  // 全音符从第三拍起：这一小节只能装下两拍，剩两拍进下一小节。
  const score = planScore([note(60, 1, 2)], { bpm: 120, timeSignature: "4/4", twoHands: false });
  assert.equal(score.measures.length, 2);
  assert.equal(score.measures[0].right[0].at, 2);
  assert.equal(score.measures[0].right[0].length, 2);
  assert.equal(score.measures[1].right[0].at, 0);
  assert.equal(score.measures[1].right[0].length, 2);
});

test("同一时刻同一只手的音合成一个和弦", () => {
  // 120 bpm 下四分音符是半秒，所以这一组是三个齐奏的四分音符。
  const score = planScore([note(60, 0, 0.5), note(64, 0, 0.5), note(67, 0, 0.5)], {
    bpm: 120,
    timeSignature: "4/4",
    twoHands: false,
  });
  const chord = score.measures[0].right[0];
  assert.deepEqual(chord.keys, ["c/4", "e/4", "g/4"]);
  assert.equal(chord.code, "q");
});

test("两只手分开排，各自补满一小节", () => {
  const score = buildScore([note(60, 0, 1, 1), note(48, 0, 1, 0)], {
    bpm: 120,
    timeSignature: "4/4",
    twoHands: true,
  });
  assert.equal(score.hands, 2);
  assert.equal(score.measures[0].right[0].at, 0);
  assert.equal(score.measures[0].left[0].at, 0);

  // 每只手都必须刚好填满一小节，否则 VexFlow 会把音排到谱表外。
  const total = (notes: { length: number }[]) =>
    notes.reduce((sum, n) => sum + n.length, 0);
  assert.equal(total(score.measures[0].right), 4);
  assert.equal(total(score.measures[0].left), 4);
});

test("空缺处补休止符，且休止符也标了 rest", () => {
  // 只有第一拍有音，后面三拍是空的
  const score = buildScore([note(60, 0, 1)], {
    bpm: 120,
    timeSignature: "4/4",
    twoHands: false,
  });
  const notes = score.measures[0].right;
  assert.equal(notes.filter((n) => !n.rest).length, 1);
  assert.ok(notes.filter((n) => n.rest).length >= 1);
  const total = notes.reduce((sum, n) => sum + n.length, 0);
  assert.equal(Math.round(total * 100) / 100, 4);
});

test("曲子开头是休止的话，休止符排在音符前面", () => {
  const score = buildScore([note(60, 1.5, 1)], {
    bpm: 120,
    timeSignature: "4/4",
    twoHands: false,
  });
  const notes = score.measures[0].right;
  assert.equal(notes[0].rest, true);
  assert.equal(notes[0].at, 0);
  assert.equal(notes[notes.length - 1].rest, false);
});

test("没有音符也不会崩", () => {
  const score = buildScore([], { bpm: 120, timeSignature: "4/4", twoHands: false });
  assert.deepEqual(score.measures, []);
});
