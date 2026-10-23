import {
  Accidental,
  Formatter,
  KeySignature,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  Voice,
  type RenderContext,
} from "vexflow";
import type { Measure, Score, ScoreNote } from "./notation";

/**
 * 把量化好的谱画出来。
 *
 * 这一层只做一件事：把 `Score` 里的数据结构交给 VexFlow。它不知道 MIDI，不知道
 * 难度分，也不知道歌是谁写的。分成这样是有意的——量化（notation.ts）错了可以单
 * 元测试，排版错了可以换引擎，二者不必互相牵连。
 *
 * 屏幕显示和导出共用同一个 `draw()`：界面上是 Canvas，A4 导出也是 Canvas，只有
 * "导出 SVG / 打印"那两下在屏幕外序列化一份 SVG，全程不进渲染树。
 */

/** 谱表自己的高度：五条线加上上下留给上加线、下加线的余量。 */
const STAVE_HEIGHT = 78;
/** 大谱表里高音谱表与低音谱表之间的距离，够放低音这一行的下加线。 */
const GRAND_GAP = 86;
/** 下一行系统与下一行之间留的空。 */
const SYSTEM_GAP = 26;
/**
 * 天头与地脚。
 *
 * 音符并不都待在五条线里：上加线、一个八度以上的音、低音谱表下方的下加线，都会
 * 探到谱表外面。这两块就是留给它们的。
 */
const TOP_PAD = 16;
const BOTTOM_PAD = 26;

export type StaffLayout = {
  /** 一行的宽度（像素）。 */
  width: number;
  /** 一行放几个小节。 */
  measuresPerLine: number;
  /** 单手曲目用哪一个谱表。 */
  singleClef: "treble" | "bass";
};

/**
 * 把 "C# minor" 这类写法转成 VexFlow 认得的 "C#m"。
 *
 * 项目的调名来自 MIDI 文件自己的 meta 事件，或 midi.ts 的推断，两种写法的量：
 * "Bb major"、"C# minor"。VexFlow 的调号表只收 "Bb"、"C#m" 这样的短写法。
 */
export function vexKeyOf(key: string | null): string | null {
  if (!key) return null;
  const match = /^\s*([A-Ga-g])([#b♯♭]?)\s*(major|minor|大调|小调)?\s*$/.exec(key.trim());
  if (!match) return null;
  const accidental = (match[2] ?? "").replace("♯", "#").replace("♭", "b");
  const tonic = match[1].toUpperCase() + accidental;
  const scale = match[3];
  const minor = scale === "minor" || scale === "小调";
  return minor ? `${tonic}m` : tonic;
}

/** 一个 ScoreNote 变成 VexFlow 的 StaveNote。休止符写成带 r 的时值。 */
function toStaveNote(note: ScoreNote): StaveNote {
  const suffix = note.rest ? "r" : "";
  const duration = `${note.code}${suffix}`;
  return new StaveNote({
    keys: note.rest ? ["b/4"] : note.keys,
    duration,
    dots: note.dots,
  });
}

export type DrawOptions = {
  score: Score;
  layout: StaffLayout;
  /** VexFlow 的调号写法，见 vexKeyOf。 */
  key: string | null;
  /** 画到第几小节（不含，0 起）。 */
  upTo: number;
  /** 从第几小节开始画（0 起）。打印分页时每一页都是一段。 */
  from?: number;
};

/**
 * 画，并返回画到第几小节。
 *
 * 之所以返回的是"画了多少"而不是"画完了没有"：界面需要知道下一次按"再多些"
 * 时还剩多少，而这个数字只有真正排过版才知道——太长的小节会被挤掉重排行。
 */
export function draw(context: RenderContext, options: DrawOptions): number {
  const { score, layout, key } = options;
  const hands = score.hands;
  const systemHeight = hands === 2 ? STAVE_HEIGHT + GRAND_GAP : STAVE_HEIGHT;
  const start = Math.max(0, Math.min(options.from ?? 0, score.measures.length));
  const shown = Math.min(options.upTo, score.measures.length);
  const perLine = Math.max(1, layout.measuresPerLine);
  const lines = Math.max(1, Math.ceil((shown - start) / perLine));

  let x = 0;
  let y = TOP_PAD;
  let drawn = start;

  for (let line = 0; line < lines && drawn < shown; line++) {
    const row = score.measures.slice(drawn, drawn + perLine);
    const widths = lineWidths(row.length, layout.width);
    x = 0;

    row.forEach((measure, column) => {
      const firstOfLine = column === 0;
      const firstOfScore = drawn === 0 && column === 0;
      const width = widths[column];

      const treble = new Stave(x, y, width);
      const bass =
        hands === 2 ? new Stave(x, y + GRAND_GAP, width) : (null as Stave | null);

      // 谱号与调号只在每一行行首重画；拍号只写一次，写在全曲第一小节。
      if (firstOfLine) {
        treble.addClef(hands === 2 ? "treble" : layout.singleClef);
        if (bass) bass.addClef("bass");
        if (key) {
          treble.addModifier(new KeySignature(key));
          if (bass) bass.addModifier(new KeySignature(key));
        }
      }
      if (firstOfScore) {
        treble.addTimeSignature(`${score.numerator}/${score.denominator}`);
      }

      treble.setContext(context).draw();
      bass?.setContext(context).draw();

      if (hands === 2 && bass) {
        // 连谱号：大括号，把两行绑成一架钢琴。
        new StaveConnector(treble, bass)
          .setType("brace")
          .setContext(context)
          .draw();
      }

      // 两只手用同一个 Formatter 对齐：不然同一小节的左右手会错开。
      const trebleVoice = voiceFor(treble, measure, "right", score);
      const bassVoice = bass ? voiceFor(bass, measure, "left", score) : null;

      const voices = bassVoice ? [trebleVoice, bassVoice] : [trebleVoice];
      if (key) Accidental.applyAccidentals(voices, key);

      const formatter = new Formatter();
      if (bassVoice) formatter.joinVoices([trebleVoice, bassVoice]);
      formatter.format(voices, width - 16);

      trebleVoice.draw(context, treble);
      bassVoice?.draw(context, bass as Stave);

      x += width;
    });

    drawn += row.length;
    y += systemHeight + SYSTEM_GAP;
  }

  return drawn;
}

/** 一行内各小节的宽度：带谱号的第一小节要宽一些；右侧留一点，终结的小节线不至于被裁掉。 */
function lineWidths(count: number, total: number): number[] {
  const usable = total - 8;
  const base = usable / (count + 0.55);
  const widths: number[] = [];
  for (let i = 0; i < count; i++) widths.push(i === 0 ? base * 1.55 : base);
  return widths;
}

/**
 * 第 index 个小节画在了哪里（谱面坐标，单位和 layout.width 一致）。
 *
 * 屏幕上的高亮层和"点谱面定位"都要问这个问题，而答案只有排版逻辑自己知道——
 * 每行末行可能更宽（draw 里按 row.length 分宽度）、行首带谱号的那列也宽一格。
 * 这里按 draw() 的同一条公式反推，两边永远对得上；draw 改了排版，这里必须跟。
 */
export function measureRect(
  index: number,
  options: DrawOptions,
): { x: number; y: number; width: number; height: number } | null {
  const { score, layout } = options;
  const start = Math.max(0, Math.min(options.from ?? 0, score.measures.length));
  const shown = Math.min(options.upTo, score.measures.length);
  if (index < start || index >= shown) return null;
  const perLine = Math.max(1, layout.measuresPerLine);
  const line = Math.floor((index - start) / perLine);
  const rowStart = start + line * perLine;
  const rowLen = Math.min(perLine, shown - rowStart);
  const widths = lineWidths(rowLen, layout.width);
  const column = index - rowStart;
  return {
    x: widths.slice(0, column).reduce((sum, w) => sum + w, 0),
    y: TOP_PAD + line * (systemHeightOf(score) + SYSTEM_GAP),
    width: widths[column],
    height: systemHeightOf(score),
  };
}

function voiceFor(stave: Stave, measure: Measure, hand: "right" | "left", score: Score): Voice {
  const notes = (hand === "right" ? measure.right : measure.left).map(toStaveNote);
  const voice = new Voice({
    numBeats: score.beatsPerMeasure,
    beatValue: 4,
  });
  // SOFT：填不满一小节也照画。库 MINUS 一个 tick 都会抛错，而 MIDI 世界里
  // 差半拍是常态——宁可少一点，也不要整个窗口打不开。
  voice.setMode(Voice.Mode.SOFT);
  voice.addTickables(notes.length > 0 ? notes : [wholeMeasureRest(score)]);
  return voice;
}

function wholeMeasureRest(score: Score): StaveNote {
  return new StaveNote({ keys: ["b/4"], duration: score.beatsPerMeasure >= 4 ? "wr" : "hr" });
}

/** 一行谱（单手一行、双手一对）本身的高度。分页和画面高度都按它算。 */
export function systemHeightOf(score: Score): number {
  return score.hands === 2 ? STAVE_HEIGHT + GRAND_GAP : STAVE_HEIGHT;
}

/** 行与行之间的距离，单位是 VexFlow 的坐标。 */
export const SYSTEM_GAP_UNITS = SYSTEM_GAP;
/** 天头加地脚，单位是 VexFlow 的坐标。 */
export const VERTICAL_PAD_UNITS = TOP_PAD + BOTTOM_PAD;

/** 算这一次排版需要的画布高度，好让 Renderer 先 resize。 */
export function scoreHeight(score: Score, layout: StaffLayout, upTo: number, from = 0): number {
  const start = Math.max(0, Math.min(from, score.measures.length));
  const shown = Math.min(upTo, score.measures.length);
  const perLine = Math.max(1, layout.measuresPerLine);
  const lines = Math.max(1, Math.ceil((shown - start) / perLine));
  const systemHeight = systemHeightOf(score);
  return (
    TOP_PAD + BOTTOM_PAD + lines * systemHeight + Math.max(0, lines - 1) * SYSTEM_GAP
  );
}

/**
 * 量出这一次需要多高。
 *
 * 以前这里先在屏幕外用 SVG 画一遍再量实际包围盒，因为估高会差那么几个像素。
 * 后来 SVG 后端整个退到了离屏（见 renderToHost 的注释），屏外量高的那道工序也
 * 就跟着走了——按公式来，上下各多留几个像素的余量，纸上多一小条空白，比整个
 * 应用崩溃便宜得多。
 */
export function measureHeight(options: DrawOptions): number {
  return scoreHeight(options.score, options.layout, options.upTo, options.from ?? 0);
}

/**
 * 画到界面里：Canvas 后端。
 *
 * 为什么不是 SVG：WebView2 的 SVG 光栅化在相当一部分机器上会把渲染进程整个带崩
 * ——切到五线谱，窗口瞬间只剩底色，也就是"整个应用崩溃"。同一个页面里的
 * WebGL 着色器背景一直跑得好好的，说明崩的不是 GPU，是 SVG 那条路径。Canvas
 * 走的是另一条（主界面和 A4 导出都在这条路上），所以界面显示改由它承担。
 *
 * `scale` 放大内部像素保证高分屏不糊；CSS 尺寸交给宿主（width:100%）。
 */
export function renderToHost(host: HTMLDivElement, options: DrawOptions, scale = 1): number {
  host.innerHTML = "";
  const canvas = document.createElement("canvas");
  host.appendChild(canvas);
  const drawn = renderToCanvas(canvas, options, scale);
  // VexFlow 的 resize() 会顺手把内联样式写成 layout.width×scale 的像素宽——scale=2
  // 时画布的 CSS 宽就是容器的两倍，右侧整段被裁掉，看起来像"谱太大显示不全"。
  // 画完把样式夺回来：谱跟容器一样宽，内在像素照旧是放大的那份，清晰度不受影响。
  canvas.style.cssText = "display:block;width:100%;height:auto";
  return drawn;
}

/**
 * 画一份 SVG——只给导出用。
 *
 * 宿主不需要挂到文档上：挂上去就可能被画出来，而画出来就是崩溃的入口。序列化
 * 成字符串再交给下载，全程不进渲染树。代价是 getBBox() 量不了，viewBox 按估算
 * 的高度来，上下可能多几个像素的空白——同样，比崩溃便宜。
 */
export function renderToSvgHost(host: HTMLDivElement, options: DrawOptions): SVGSVGElement | null {
  host.innerHTML = "";
  const height = scoreHeight(options.score, options.layout, options.upTo, options.from ?? 0);
  const renderer = new Renderer(host, Renderer.Backends.SVG);
  renderer.resize(options.layout.width, height);
  draw(renderer.getContext(), options);
  return host.querySelector("svg");
}

/**
 * 画到 Canvas 上，用于导出位图。
 *
 * `scale` 是"把 VexFlow 的坐标放大几倍"。VexFlow 的 resize() 会自己按设备像素比
 * 再乘一遍并把画布撑到那么大，所以这里要先把目标尺寸乘上 scale 交给它，否则画布
 * 只有 1/scale，画出来的图右侧和下边会被裁掉。
 */
export function renderToCanvas(canvas: HTMLCanvasElement, options: DrawOptions, scale = 1): number {
  const height = measureHeight(options);
  const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
  renderer.resize(options.layout.width * scale, height * scale);
  const context = renderer.getContext();
  context.scale(scale, scale);
  // 宣纸底色：导出的图不能是透明的，否则打出来是黑块。
  context.save();
  context.setFillStyle("#FBF6E9");
  context.fillRect(0, 0, options.layout.width, height);
  context.restore();
  return draw(context, options);
}
