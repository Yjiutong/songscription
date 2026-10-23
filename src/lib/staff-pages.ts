import type { DrawOptions } from "./staff-render";
import {
  SYSTEM_GAP_UNITS,
  VERTICAL_PAD_UNITS,
  measureHeight,
  renderToCanvas,
  systemHeightOf,
} from "./staff-render";
import { pdfFromJpegs } from "./pdf";
import { zipStore } from "./zip";

/**
 * 把谱子排成 A4 的一页一页。
 *
 * 屏幕上是一长条，纸不是。纸有边，一页只放得下那么几行，行还得按小节断开——
 * 不能从小节中间断。所以这里做的是排版里最老的那件事：算一页能装几行，装满就翻页。
 *
 * 高度不靠估算。估算会把探出五线之外的音（上加线、低音下加线）算漏，于是一页排到
 * 最后一行时那几个音就掉到纸外面去了。真实的做法是先把这一段真的画一遍、量出它多
 * 高，超了就把最后一行挪到下一页。
 */

/**
 * 谱面自己的设计单位。
 *
 * VexFlow 的坐标不是像素，是一套自己的尺度：一个谱表高 78，两行大谱表加间距 164。
 * 这里定一个 1000 宽的设计宽度，等于 A4 去掉页边距后那 182 毫米。于是 1 毫米约合
 * 5.5 个单位，一行四小节的小节约 47 毫米——和真的印刷谱差不多宽。定好设计单位后，
 * 导出多少 dpi 都只是乘一个倍数，谱面的比例不会变。
 */
const DESIGN_WIDTH = 1000;

/** A4：210 × 297 毫米。 */
export const A4_MM = { width: 210, height: 297 };

/** 首页页眉高一些：曲名要大，底下还要一行调号拍号。 */
const HEADER_FIRST_MM = 22;
const HEADER_REST_MM = 12;
const MARGIN_MM = 14;

export type PageGeometry = {
  dpi: number;
  widthPx: number;
  heightPx: number;
  marginPx: number;
  contentWidthPx: number;
  contentHeightPx: number;
};

/** 毫米换成这个 dpi 下的像素。 */
function px(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi);
}

export function a4Geometry(dpi = 300, marginMm = MARGIN_MM): PageGeometry {
  const widthPx = px(A4_MM.width, dpi);
  const heightPx = px(A4_MM.height, dpi);
  const marginPx = px(marginMm, dpi);
  return {
    dpi,
    widthPx,
    heightPx,
    marginPx,
    contentWidthPx: widthPx - marginPx * 2,
    contentHeightPx: heightPx - marginPx * 2,
  };
}

export type PageSlice = { from: number; to: number };

export type SheetOptions = {
  dpi: number;
  measuresPerLine: number;
  /** 只排到第几小节；不写就是全曲。 */
  upTo?: number;
};

/**
 * 把若干行装进若干页。
 *
 * 抽出来是为了能单独测试：measure 由外面注入，测试里塞一个假的高度函数就能验证分页，
 * 不必真的去画一遍谱。
 */
export function packLines(input: {
  lines: number;
  measuresPerLine: number;
  total: number;
  /** 第几页还剩多少高度可用（设计单位）。 */
  budgetOf: (pageIndex: number) => number;
  /** 先估个大概：装 n 行会有多高。 */
  estimate: (count: number) => number;
  /** 真的量一次：第 fromLine 行到第 toLine 行（不含）有多高。 */
  measure: (fromLine: number, toLine: number) => number;
}): PageSlice[] {
  const { lines, measuresPerLine, total, budgetOf, estimate, measure } = input;
  const slices: PageSlice[] = [];
  if (lines <= 0) return slices;

  let line = 0;
  while (line < lines) {
    const budget = budgetOf(slices.length);
    // 先按估算一口气装到装不下为止，再回头拿实测的高度往回收。
    let take = 1;
    while (line + take < lines && estimate(take + 1) <= budget) take++;
    while (take > 1 && measure(line, line + take) > budget) take--;

    slices.push({
      from: Math.min(line * measuresPerLine, total),
      to: Math.min((line + take) * measuresPerLine, total),
    });
    line += take;
  }
  return slices;
}

/** 分页：返回每一页各排哪几小节。 */
export function planPages(base: DrawOptions, options: SheetOptions): PageSlice[] {
  const geometry = a4Geometry(options.dpi);
  const scale = geometry.contentWidthPx / DESIGN_WIDTH;
  const layout = {
    width: DESIGN_WIDTH,
    measuresPerLine: options.measuresPerLine,
    singleClef: base.layout.singleClef,
  };
  const score = base.score;
  const total = Math.min(options.upTo ?? score.measures.length, score.measures.length);
  const systemHeight = systemHeightOf(score);
  const lines = Math.max(1, Math.ceil(total / Math.max(1, options.measuresPerLine)));

  // 同一段只量一次：分页过程中会反复问同一段多高。
  const cache = new Map<string, number>();
  const heightOf = (fromLine: number, toLine: number): number => {
    const from = Math.min(fromLine * options.measuresPerLine, total);
    const to = Math.min(toLine * options.measuresPerLine, total);
    const cacheKey = `${from}:${to}`;
    let cached = cache.get(cacheKey);
    if (cached === undefined) {
      cached = measureHeight({ ...base, layout, from, upTo: to });
      cache.set(cacheKey, cached);
    }
    return cached;
  };

  const headerPx = (pageIndex: number) =>
    px(pageIndex === 0 ? HEADER_FIRST_MM : HEADER_REST_MM, options.dpi);

  return packLines({
    lines,
    measuresPerLine: options.measuresPerLine,
    total,
    budgetOf: (pageIndex) => (geometry.contentHeightPx - headerPx(pageIndex)) / scale,
    estimate: (count) =>
      VERTICAL_PAD_UNITS + count * systemHeight + (count - 1) * SYSTEM_GAP_UNITS,
    measure: heightOf,
  });
}

export type PageMeta = {
  title: string;
  /** 给人看的调名，如 "降B大调"。 */
  key: string | null;
  timeSignature: string | null;
  bpm: number | null;
};

/**
 * 页眉上要写"降B大调"这样四个字，写不下 piece.ts 里那一整句"两个降号（降B、降E），
 * 也就是要记住两个黑键"。这里是谱面专用的短写法。
 */
export function keyLabel(key: string | null): string | null {
  if (!key) return null;
  const match = /^\s*([A-Ga-g])([#b♯♭]?)\s*(major|minor|大调|小调)?\s*$/.exec(key.trim());
  if (!match) return key.trim() || null;
  const accidental = (match[2] ?? "").replace("♯", "#").replace("♭", "b");
  const prefix = accidental === "#" ? "升" : accidental === "b" ? "降" : "";
  const minor = match[3] === "minor" || match[3] === "小调";
  return `${prefix}${match[1].toUpperCase()}${minor ? "小调" : "大调"}`;
}

const PAPER = "#FBF6E9";
const INK = "#241A12";
const INK_SOFT = "#574636";
const GOLD = "#D9B24C";
const BOOK_FONT = '"Source Han Serif SC","Songti SC","STSong","SimSun",serif';
const LABEL_FONT = '"Source Han Sans SC","PingFang SC","Microsoft YaHei",sans-serif';

/**
 * 画一页。
 *
 * 页上不只有谱：还有曲名、调号拍号、页码，和一条界行的鎏金细线——一页纸得说清自己
 * 是谁的第几页，打印出来散在谱架上才认得回来。
 */
export function renderPage(input: {
  base: DrawOptions;
  slice: PageSlice;
  geometry: PageGeometry;
  page: { index: number; total: number };
  meta: PageMeta;
  measuresPerLine: number;
}): HTMLCanvasElement {
  const { base, slice, geometry, page, meta, measuresPerLine } = input;
  const scale = geometry.contentWidthPx / DESIGN_WIDTH;
  const layout = {
    width: DESIGN_WIDTH,
    measuresPerLine,
    singleClef: base.layout.singleClef,
  };

  const canvas = document.createElement("canvas");
  canvas.width = geometry.widthPx;
  canvas.height = geometry.heightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("这个浏览器不肯给 canvas 的画笔");

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = "alphabetic";

  const margin = geometry.marginPx;
  const headerPx =
    px(page.index === 0 ? HEADER_FIRST_MM : HEADER_REST_MM, geometry.dpi);
  const top = margin + headerPx;

  // 谱先画在一张自己的小画布上，再抻到纸上这一页的内容区里。
  const staff = document.createElement("canvas");
  renderToCanvas(staff, { ...base, layout, from: slice.from, upTo: slice.to }, scale);
  if (staff.width > 0 && staff.height > 0) {
    const drawnWidth = geometry.contentWidthPx;
    const drawnHeight = (staff.height * drawnWidth) / staff.width;
    ctx.drawImage(staff, 0, 0, staff.width, staff.height, margin, top, drawnWidth, drawnHeight);
  }

  drawHeader(ctx, geometry, { top, margin }, page, meta);
  drawFooter(ctx, geometry, page, meta);
  return canvas;
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  geometry: PageGeometry,
  box: { top: number; margin: number },
  page: { index: number; total: number },
  meta: PageMeta,
) {
  const { dpi } = geometry;
  const margin = box.margin;
  const baselineOf = (mm: number) => margin + px(mm, dpi);

  if (page.index === 0) {
    ctx.fillStyle = INK;
    ctx.font = `${px(7.4, dpi)}px ${BOOK_FONT}`;
    ctx.fillText(meta.title || "无题", margin, baselineOf(7.4));

    const parts = [
      meta.key,
      meta.timeSignature,
      meta.bpm ? `♩ = ${Math.round(meta.bpm)}` : null,
    ].filter((part): part is string => Boolean(part));
    if (parts.length > 0) {
      ctx.fillStyle = INK_SOFT;
      ctx.font = `${px(4, dpi)}px ${LABEL_FONT}`;
      ctx.fillText(parts.join("　·　"), margin, baselineOf(14.4));
    }
  } else {
    ctx.fillStyle = INK_SOFT;
    ctx.font = `${px(4.6, dpi)}px ${BOOK_FONT}`;
    ctx.fillText(meta.title || "无题", margin, baselineOf(5));
  }

  // 界行：一条鎏金细线，把页眉和谱面隔开。
  const lineY = box.top - px(4, dpi);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(1, px(0.4, dpi));
  ctx.beginPath();
  ctx.moveTo(margin, lineY);
  ctx.lineTo(geometry.widthPx - margin, lineY);
  ctx.stroke();
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  geometry: PageGeometry,
  page: { index: number; total: number },
  meta: PageMeta,
) {
  const { dpi, marginPx, widthPx, heightPx } = geometry;
  ctx.fillStyle = INK_SOFT;
  ctx.font = `${px(3.4, dpi)}px ${LABEL_FONT}`;

  const label = `第 ${page.index + 1} / ${page.total} 页`;
  ctx.textAlign = "right";
  ctx.fillText(label, widthPx - marginPx, heightPx - marginPx + px(4.5, dpi));

  if (page.index === 0) {
    ctx.textAlign = "left";
    ctx.fillText(meta.title || "无题", marginPx, heightPx - marginPx + px(4.5, dpi));
  }
  ctx.textAlign = "left";
}

export type SheetFormat = "png" | "jpg" | "pdf";

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("这一页没能转成图片"))),
      type,
      quality,
    );
  });
}

async function bytesOf(blob: Blob): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await blob.arrayBuffer());
}

export type SheetFile = { name: string; data: Uint8Array<ArrayBuffer>; type: string };

/**
 * 排成一沓 A4，把文件交回来——不落到任何地方。
 *
 * 给了 mobile 一个新去处就要分支一次的情况不会发生：谁拿到这些文件，谁决定
 * 它们往哪儿去。浏览器把它下载下来，桌面应用把它写进那个人指定的文件夹。
 */
export async function renderSheetFiles(
  base: DrawOptions,
  meta: PageMeta,
  options: SheetOptions & { format: SheetFormat },
  onProgress?: (done: number, total: number) => void,
): Promise<{ pages: number; files: SheetFile[] }> {
  const geometry = a4Geometry(options.dpi);
  const slices = planPages(base, options);
  if (slices.length === 0) throw new Error("这首曲子一个小节也没有");

  // 分页和画页都得按"纸上的版式"来：宽度回到设计单位，一行几小节由调用方定。
  const sheetBase: DrawOptions = {
    ...base,
    upTo: options.upTo ?? base.score.measures.length,
    layout: {
      ...base.layout,
      width: DESIGN_WIDTH,
      measuresPerLine: options.measuresPerLine,
    },
  };

  const name = safeFileName(meta.title);
  const files: SheetFile[] = [];
  const jpegs: { jpeg: Uint8Array<ArrayBuffer>; width: number; height: number }[] = [];

  for (let index = 0; index < slices.length; index++) {
    const canvas = renderPage({
      base: sheetBase,
      slice: slices[index],
      geometry,
      page: { index, total: slices.length },
      meta,
      measuresPerLine: options.measuresPerLine,
    });

    if (options.format === "pdf") {
      // PDF 里放 JPEG 最划算：谱面是黑白线条，压下来只有 PNG 的零头。
      const blob = await toBlob(canvas, "image/jpeg", 0.92);
      jpegs.push({ jpeg: await bytesOf(blob), width: canvas.width, height: canvas.height });
    } else {
      const isPng = options.format === "png";
      const blob = await toBlob(canvas, isPng ? "image/png" : "image/jpeg", isPng ? undefined : 0.92);
      const suffix = isPng ? "png" : "jpg";
      const filename =
        slices.length === 1
          ? `${name}-A4.${suffix}`
          : `${name}-A4-${String(index + 1).padStart(2, "0")}.${suffix}`;
      files.push({
        name: filename,
        data: await bytesOf(blob),
        type: isPng ? "image/png" : "image/jpeg",
      });
    }

    onProgress?.(index + 1, slices.length);
    // 让出主线程：长曲子要排十几页，不给浏览器喘气的话进度条是不动的。
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  if (options.format === "pdf") {
    const blob = pdfFromJpegs(jpegs);
    return {
      pages: slices.length,
      files: [
        {
          name: `${name}-A4.pdf`,
          data: await bytesOf(blob),
          type: "application/pdf",
        },
      ],
    };
  }

  return { pages: slices.length, files };
}

/**
 * 排成 A4 的一册并下载下来。
 *
 * PNG 和 JPG 一页一个文件，多页就装进 zip；PDF 始终是一个文件。桌面应用的路径
 * 是 renderSheetFiles + 输出目录，参见 src/components/Settings.tsx。
 */
export async function exportSheet(
  base: DrawOptions,
  meta: PageMeta,
  options: SheetOptions & { format: SheetFormat },
  onProgress?: (done: number, total: number) => void,
): Promise<{ pages: number; filename: string }> {
  const { pages, files } = await renderSheetFiles(base, meta, options, onProgress);

  if (files.length === 1) {
    const file = files[0];
    saveBlob(new Blob([file.data], { type: file.type }), file.name);
    return { pages, filename: file.name };
  }

  const name = safeFileName(meta.title);
  const filename = `${name}-A4.zip`;
  saveBlob(zipStore(files), filename);
  return { pages, filename };
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** 文件名里不能有的东西，Windows 和 macOS 各有各的忌讳，一并替掉。 */
export function safeFileName(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim() || "五线谱";
}
