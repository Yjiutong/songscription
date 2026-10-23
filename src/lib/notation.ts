import type { Note } from "./audio";

/**
 * 把一段弹好的琴变成可以印出来的东西。
 *
 * 这里是整条链路里最难的一段，却不该是最聪明的一段。MIDI 记录的是「第 2.317
 * 秒按下了第 63 号键，按住 0.284 秒」，而谱面记录的是「第二小节第一拍的后半拍，
 * 一个带点的八分音符」。二者之间的转换叫量化，它天生有损：真人弹出来的音永远
 * 落在网格的缝里。所以这里的策略是**尽量少改**：只把每个音吸到最近的十六分音符
 * 格子上，绝不「修正」演奏。
 *
 * 全部逻辑刻意写成不碰 DOM 的纯函数，于是它能像其它被测的模块那样单独跑单元
 * 测试——量化出错时能一行行查，而不是看着一张画错的谱发呆。
 */

/** VexFlow 的音名写法：中央 C 是 c/4。 */
export type ScoreNote = {
  /** 和弦是多个键名，单音只有一个。 */
  keys: string[];
  /** 时长码：w h q 8 16（整、二、四、八、十六分音符）。 */
  code: "w" | "h" | "q" | "8" | "16";
  /** 附点数。带一个点的四分音符写作 "q" + 1。 */
  dots: number;
  /** 休止符。 */
  rest: boolean;
  /** 本小节内的起始位置，单位为四分音符（0 就是小节第一拍）。 */
  at: number;
  /** 时值长度，单位为四分音符。 */
  length: number;
};

export type Measure = {
  /** 右手一行；单手曲统一放在这里。 */
  right: ScoreNote[];
  /** 左手一行，单手曲为空数组。 */
  left: ScoreNote[];
};

export type Score = {
  /** 一小节有几个四分音符：4/4 是 4，6/8 是 3。 */
  beatsPerMeasure: number;
  numerator: number;
  denominator: number;
  hands: 1 | 2;
  measures: Measure[];
  /** 量化的事实上限/下限单位，单位为四分音符（0.25 即十六分音符）。 */
  grid: number;
};

export type ScoreOptions = {
  /** 每分钟拍数；没有就按 120。 */
  bpm: number | null;
  /** "4/4"、"6/8" 这样的拍号字符串。 */
  timeSignature: string | null;
  /** 文件自己分了双手，或者分析器认了出来。 */
  twoHands: boolean;
  /** 量化的分辨率：一个四分音符切成几格。4 = 量化到十六分音符。 */
  grid?: number;
};

const PITCHES = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];

/** MIDI 音高号转成 VexFlow 的键名。60 → c/4。 */
export function keyOf(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${PITCHES[midi % 12]}/${octave}`;
}

/** "6/8" → [6, 8]。认不出来返回 null，让调用方回落到 4/4。 */
export function parseTimeSignature(signature: string | null): [number, number] | null {
  const match = /^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*$/.exec(signature ?? "");
  if (!match) return null;
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (numerator < 1 || denominator < 1 || denominator > 32) return null;
  return [numerator, denominator];
}

/** 谱上写得出来的长度：各自的时值、码与附点数。 */
const STEPS: { length: number; code: ScoreNote["code"]; dots: number }[] = [
  { length: 4, code: "w", dots: 0 },
  { length: 3, code: "h", dots: 1 },
  { length: 2, code: "h", dots: 0 },
  { length: 1.5, code: "q", dots: 1 },
  { length: 1, code: "q", dots: 0 },
  { length: 0.75, code: "8", dots: 1 },
  { length: 0.5, code: "8", dots: 0 },
  { length: 0.25, code: "16", dots: 0 },
];

/**
 * 一段时值（单位：四分音符）写成「一个音符（可带附点）」。
 *
 * 谱上能写出来的长度只有那么几种，所以取最接近的那一个。0.31 会被吸到 0.25，
 * 0.29 也是 0.25 而不是 0.5——误差是量化固有的，但绝不会把一个短音变成两倍长。
 */
export function toCode(quarters: number): { code: ScoreNote["code"]; dots: number; length: number } {
  let best = STEPS[STEPS.length - 1];
  for (const step of STEPS) {
    if (Math.abs(step.length - quarters) < Math.abs(best.length - quarters)) best = step;
  }
  return { code: best.code, dots: best.dots, length: best.length };
}

/** 浮点累减会在 0.25 的网格上留下 1e-16 的残渣，所以每一步都收一次。 */
function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** 把一段空白切成若干休止符，大的在前。 */
function restInto(gap: number, at: number): ScoreNote[] {
  const pieces: ScoreNote[] = [];
  let left = round(gap);
  let cursor = round(at);
  let guard = 0;
  while (left > 0.001 && guard++ < 64) {
    const { code, dots, length } = toCode(left);
    // 不许把一小段空白补过头：宁可两个休止符，也不能有半拍溢出。
    const taken = Math.min(length, left);
    pieces.push({ keys: ["b/4"], code, dots, rest: true, at: cursor, length: taken });
    cursor = round(cursor + taken);
    left = round(left - taken);
  }
  return pieces;
}

/** 一小格里补齐休止符：开头、音符之间、以及小节的尾巴。 */
function pad(notes: ScoreNote[], beatsPerMeasure: number): ScoreNote[] {
  const out: ScoreNote[] = [];
  let cursor = 0;
  for (const note of [...notes].sort((a, b) => a.at - b.at)) {
    const gap = round(note.at - cursor);
    if (gap > 0.001) out.push(...restInto(gap, cursor));
    out.push(note);
    cursor = round(note.at + note.length);
  }
  const tail = round(beatsPerMeasure - cursor);
  if (tail > 0.001) out.push(...restInto(tail, cursor));
  return out;
}

/**
 * 量化并分小节。
 *
 * 跨小节线的音符会被就地切开：前半格拉满这一小节，余下部分作为新的音从下一小节
 * 的头开始。严格地说切开处该画一条连音线——但一个被切开的音至少"看得见、位置对"，
 * 而一个为了不切开被整体挪位的音，两者都没有。
 *
 * 同一时刻、同一只手的音合成一个和弦；VexFlow 用 `keys: string[]` 表示。
 */
export function planScore(notes: Note[], options: ScoreOptions): Score {
  const bpm = options.bpm && options.bpm > 0 ? options.bpm : 120;
  const secondsPerQuarter = 60 / bpm;
  const grid = options.grid ?? 4; // 量化到十六分音符
  const [numerator, denominator] = parseTimeSignature(options.timeSignature) ?? [4, 4];
  const beatsPerMeasure = Math.max(0.5, (numerator * 4) / denominator);
  const hands: 1 | 2 = options.twoHands || new Set(notes.map((n) => n.hand)).size > 1 ? 2 : 1;

  // 第一步：把每个音吸到网格上。起点取最近的格，长度至少占一个格。
  const spans = notes
    .filter((note) => note.duration > 0)
    .map((note) => {
      const start = Math.round((note.time / secondsPerQuarter) * grid) / grid;
      const length = Math.round((note.duration / secondsPerQuarter) * grid) / grid;
      return {
        start: Math.max(0, start),
        // 一个格，也就是这首曲子能量化的最短事实。
        length: Math.max(1 / grid, Math.min(length, 4)),
        pitch: note.midi,
        hand: hands === 2 ? note.hand : (1 as 0 | 1),
      };
    })
    .sort((a, b) => a.start - b.start || a.pitch - b.pitch);

  // 第二步：切过小节线，并按「小节 + 手 + 起点」归堆，堆里的音是一个和弦。
  type Chord = { measure: number; at: number; length: number; pitches: number[]; hand: 0 | 1 };
  const chords = new Map<string, Chord>();

  for (const span of spans) {
    let remaining = round(span.length);
    let cursor = round(span.start);
    let guard = 0;
    while (remaining > 0.001 && guard++ < 64) {
      const index = Math.floor(cursor / beatsPerMeasure + 1e-9);
      const localStart = round(cursor - index * beatsPerMeasure);
      const space = round(beatsPerMeasure - localStart);
      if (space <= 0.001) {
        // 正好压在小节线上：从下一小节重新开始，不前移也不丢弃。
        cursor = round((index + 1) * beatsPerMeasure);
        continue;
      }
      const taken = Math.min(remaining, space);
      const key = `${index}|${span.hand}|${localStart}`;
      const hit = chords.get(key);
      if (hit) {
        hit.pitches.push(span.pitch);
        hit.length = Math.max(hit.length, taken);
      } else {
        chords.set(key, {
          measure: index,
          at: localStart,
          length: taken,
          pitches: [span.pitch],
          hand: span.hand,
        });
      }
      remaining = round(remaining - taken);
      cursor = round(cursor + taken);
    }
  }

  // 第三步：落地到小节数组中，顺手排成实际谱面用的音符形态。
  const measures: Measure[] = [];
  const measureAt = (index: number) => {
    while (measures.length <= index) measures.push({ right: [], left: [] });
    return measures[index];
  };

  for (const chord of chords.values()) {
    const { code, dots, length } = toCode(chord.length);
    const keys = [...new Set(chord.pitches.map(keyOf))].sort(
      (a, b) => pitchNumber(a) - pitchNumber(b),
    );
    const note: ScoreNote = { keys, code, dots, rest: false, at: chord.at, length };
    if (chord.measure < 0) continue;
    if (hands === 1 || chord.hand === 1) measureAt(chord.measure).right.push(note);
    else measureAt(chord.measure).left.push(note);
  }

  return { beatsPerMeasure, numerator, denominator, hands, measures, grid };
}

/** "c#/4" → 61，只用来给和弦里的音排序。 */
function pitchNumber(key: string): number {
  const [name, octave] = key.split("/");
  return Number(octave) * 12 + PITCHES.indexOf(name);
}

/**
 * 补齐每小节的休止符。
 *
 * VexFlow 排不满一小节时后面的音会串出谱表，所以每一手都必须刚好填满。
 */
export function fillRests(score: Score): Score {
  for (const measure of score.measures) {
    measure.right = pad(measure.right, score.beatsPerMeasure);
    measure.left = pad(measure.left, score.beatsPerMeasure);
  }
  return score;
}

/** 一次算完：量化 + 分小节 + 补休止符。组件里就调用这一个。 */
export function buildScore(notes: Note[], options: ScoreOptions): Score {
  return fillRests(planScore(notes, options));
}
