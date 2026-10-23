import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, Printer } from "lucide-react";
import type { Note } from "@/lib/audio";
import { buildScore } from "@/lib/notation";
import { renderToDiv, vexKeyOf, type DrawOptions } from "@/lib/staff-render";
import { getPlatform } from "@/lib/platform";
import {
  exportSheet,
  keyLabel,
  planPages,
  renderSheetFiles,
  safeFileName,
  saveBlob,
  type SheetFormat,
} from "@/lib/staff-pages";

/**
 * 五线谱。
 *
 * 一首曲子最忠实的样子不是卷帘图，是它本来的样子：写在线上的音符。这一页把
 * 存在本机的 MIDI 量化成分小节的谱面，用矢量画出来，然后把它交还给人——导出成
 * SVG，按 A4 排成一册 PNG / JPG / PDF，或者直接打印出来放在谱架上。
 *
 * 长曲一次全画会很慢，所以默认先排八小节，剩下的由读者自己决定要不要继续。
 */

const FIRST_PAGE = 8;
/** 一行排几个小节的候选项。小节少则音符大，好认；小节多则一页装得多。 */
const PER_LINE_CHOICES = [3, 4, 5, 6];
const DPI_CHOICES = [200, 300];

export function Staff({
  notes,
  title,
  bpm,
  timeSignature,
  keySignature,
  twoHands,
  className = "",
}: {
  notes: Note[];
  title: string;
  bpm: number | null;
  timeSignature: string | null;
  keySignature: string | null;
  twoHands: boolean;
  className?: string;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  const [shown, setShown] = useState(FIRST_PAGE);
  const [failed, setFailed] = useState<string | null>(null);

  // A4 导出的那块小面板：点开才有用，收着的时候不占地方。
  const [sheetOpen, setSheetOpen] = useState(false);
  const [perLine, setPerLine] = useState(4);
  const [dpi, setDpi] = useState(300);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const score = useMemo(
    () => buildScore(notes, { bpm, timeSignature, twoHands }),
    [notes, bpm, timeSignature, twoHands],
  );
  const total = score.measures.length;
  const visible = Math.min(shown, total);

  const singleClef = useMemo<"treble" | "bass">(() => {
    if (notes.length === 0) return "treble";
    const sorted = [...notes].map((n) => n.midi).sort((a, b) => a - b);
    return (sorted[Math.floor(sorted.length / 2)] ?? 60) < 57 ? "bass" : "treble";
  }, [notes]);

  const layout = useMemo(
    () => ({
      width,
      // 一小节最少约 180px 才排得下四个四分音符，多宽都不宜超过六小节一行。
      measuresPerLine: Math.max(1, Math.min(6, Math.floor(width / 190))),
      singleClef,
    }),
    [width, singleClef],
  );

  const options: DrawOptions = useMemo(
    () => ({ score, layout, key: vexKeyOf(keySignature), upTo: visible }),
    [score, layout, keySignature, visible],
  );

  // 容器有多宽，谱就有多宽。谱不能自己定宽：它是排在纸上，不是排在屏幕里。
  useEffect(() => {
    const node = holder.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.max(320, Math.floor(entry.contentRect.width));
      setWidth((current) => (Math.abs(current - next) > 4 ? next : current));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = holder.current;
    if (!node || total === 0) return;
    try {
      renderToDiv(node, options);
      setFailed(null);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : String(error));
    }
  }, [options, total]);

  const exportSvg = useCallback(() => {
    const svg = holder.current?.querySelector("svg");
    if (!svg) return;
    const text = new XMLSerializer().serializeToString(svg);
    saveBlob(
      new Blob([text], { type: "image/svg+xml;charset=utf-8" }),
      `${safeFileName(title)}.svg`,
    );
  }, [title]);

  // A4 是按全曲排的，跟屏幕上排到第几小节无关——要打印的谱子不会只打一半。
  useEffect(() => {
    if (!sheetOpen) return;
    let alive = true;
    setPageCount(null);
    // 量页数得真画一遍，慢；等面板先画出来再算，免得点开的动作卡住。
    const timer = setTimeout(() => {
      try {
        const slices = planPages(options, { dpi, measuresPerLine: perLine, upTo: total });
        if (alive) setPageCount(slices.length);
      } catch {
        if (alive) setPageCount(null);
      }
    }, 40);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [sheetOpen, dpi, perLine, options, total]);

  // 点到面板外面就收起来。
  useEffect(() => {
    if (!sheetOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!panel.current?.contains(event.target as Node)) setSheetOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [sheetOpen]);

  const exportA4 = useCallback(
    async (format: SheetFormat) => {
      setBusy("正在排版…");
      setSaved(null);
      try {
        const platform = await getPlatform();
        const written = await renderSheetFiles(
          { ...options, upTo: total },
          { title, key: keyLabel(keySignature), timeSignature, bpm },
          { dpi, measuresPerLine: perLine, upTo: total, format },
          (done, of) => setBusy(`正在排第 ${done} / ${of} 页`),
        );
        // 桌面版写进那个人指定的文件夹；网页版只能下载，平台自己会把话说清楚。
        if (platform.output.manageable) {
          for (const file of written.files) {
            await platform.output.write(file.name, file.data);
          }
          const where = await platform.output.dir();
          setSaved(
            written.pages > 1
              ? `已导出 ${written.pages} 页到 ${where}`
              : `已导出到 ${where}`,
          );
        } else {
          await exportSheet(
            { ...options, upTo: total },
            { title, key: keyLabel(keySignature), timeSignature, bpm },
            { dpi, measuresPerLine: perLine, upTo: total, format },
          );
          setSaved(
            written.pages > 1
              ? `已下载 ${written.files[0].name}，共 ${written.pages} 页`
              : `已下载 ${written.files[0].name}`,
          );
        }
        setSheetOpen(false);
      } catch (error) {
        setFailed(error instanceof Error ? error.message : String(error));
      } finally {
        setBusy(null);
      }
    },
    [options, total, title, keySignature, timeSignature, bpm, dpi, perLine],
  );

  const print = useCallback(() => {
    const svg = holder.current?.querySelector("svg");
    if (!svg) return;
    const window_ = window.open("", "_blank");
    if (!window_) return;
    window_.document.write(
      `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">` +
        `<title>${escapeHtml(title)} · 五线谱</title>` +
        `<style>body{margin:0;background:#FBF6E9}@page{margin:14mm}</style></head>` +
        `<body>${new XMLSerializer().serializeToString(svg)}</body></html>`,
    );
    window_.document.close();
    window_.focus();
    window_.print();
  }, [title]);

  if (total === 0) {
    return (
      <p className={`text-[13px] leading-[1.6] text-graphite-soft ${className}`}>
        这首曲子里一个音符也没有读出来，没法排成谱。
      </p>
    );
  }

  return (
    <div className={className}>
      <div
        ref={holder}
        className="overflow-x-hidden rounded-[3px] bg-paper"
        role="img"
        aria-label={`${title} 的五线谱，共 ${total} 小节，当前显示 ${visible} 小节`}
      />
      {failed && (
        <p className="mt-2 text-[12.5px] leading-[1.5] text-kraft-deep">谱没排出来：{failed}</p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[12.5px] tabular-nums text-graphite-soft">
          共 {total} 小节，已排 {visible} 小节
        </span>
        {visible < total && (
          <button
            type="button"
            onClick={() => setShown((v) => Math.min(v + 16, total))}
            className="rounded-[3px] border border-rule px-2 py-1 font-label text-[12.5px] font-semibold text-graphite transition-colors hover:bg-paper-warm"
          >
            再排版16小节
          </button>
        )}
        {visible < total && (
          <button
            type="button"
            onClick={() => setShown(total)}
            className="rounded-[3px] border border-rule px-2 py-1 font-label text-[12.5px] font-semibold text-graphite transition-colors hover:bg-paper-warm"
          >
            排到全曲
          </button>
        )}

        <span className="flex-1" />

        <button
          type="button"
          onClick={exportSvg}
          className="inline-flex items-center gap-1.5 rounded-[5px] border border-rule bg-paper px-2.5 py-1 font-label text-[12.5px] font-semibold text-graphite transition-colors hover:bg-paper-warm"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          导出 SVG
        </button>

        <div className="relative" ref={panel}>
          <button
            type="button"
            onClick={() => setSheetOpen((open) => !open)}
            disabled={busy !== null}
            aria-expanded={sheetOpen}
            className="inline-flex items-center gap-1 rounded-[5px] bg-kraft px-2.5 py-1 font-label text-[12.5px] font-semibold text-graphite transition-colors hover:bg-gold-soft disabled:opacity-60"
          >
            {busy ?? "导出 A4"}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${sheetOpen ? "rotate-180" : ""}`} aria-hidden />
          </button>

          {sheetOpen && (
            <div className="absolute bottom-full right-0 z-20 mb-1.5 w-[262px] rounded-[5px] border border-rule bg-paper p-3 text-left shadow-[0_10px_28px_rgba(42,24,14,0.28)]">
              <p className="font-label text-[11.5px] font-semibold text-graphite-soft">每行小节数</p>
              <div className="mt-1.5 flex gap-1.5">
                {PER_LINE_CHOICES.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setPerLine(choice)}
                    className={`flex-1 rounded-[3px] border px-0 py-1 font-label text-[12px] font-semibold tabular-nums transition-colors ${
                      perLine === choice
                        ? "border-kraft bg-kraft text-graphite"
                        : "border-rule bg-paper-warm text-graphite-soft hover:bg-paper"
                    }`}
                  >
                    {choice}
                  </button>
                ))}
              </div>

              <p className="mt-2.5 font-label text-[11.5px] font-semibold text-graphite-soft">清晰度</p>
              <div className="mt-1.5 flex gap-1.5">
                {DPI_CHOICES.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setDpi(choice)}
                    className={`flex-1 rounded-[3px] border px-0 py-1 font-label text-[12px] font-semibold tabular-nums transition-colors ${
                      dpi === choice
                        ? "border-kraft bg-kraft text-graphite"
                        : "border-rule bg-paper-warm text-graphite-soft hover:bg-paper"
                    }`}
                  >
                    {choice} dpi
                  </button>
                ))}
              </div>

              <div className="my-2.5 h-px bg-rule" />

              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => void exportA4("png")}
                  className="rounded-[3px] border border-rule bg-paper px-2 py-1.5 text-left font-label text-[12.5px] font-semibold text-graphite transition-colors hover:bg-paper-warm"
                >
                  PNG　每页一张
                </button>
                <button
                  type="button"
                  onClick={() => void exportA4("jpg")}
                  className="rounded-[3px] border border-rule bg-paper px-2 py-1.5 text-left font-label text-[12.5px] font-semibold text-graphite transition-colors hover:bg-paper-warm"
                >
                  JPG　每页一张
                </button>
                <button
                  type="button"
                  onClick={() => void exportA4("pdf")}
                  className="rounded-[3px] border border-rule bg-paper px-2 py-1.5 text-left font-label text-[12.5px] font-semibold text-graphite transition-colors hover:bg-paper-warm"
                >
                  PDF　合成一册
                </button>
              </div>

              <p className="mt-2 font-label text-[11.5px] leading-[1.5] text-graphite-soft">
                {pageCount === null
                  ? "正在算一共几页…"
                  : `A4 纵向，共 ${pageCount} 页；多页会打包成一个 zip。`}
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={print}
          className="inline-flex items-center gap-1.5 rounded-[5px] border border-rule bg-paper px-2.5 py-1 font-label text-[12.5px] font-semibold text-graphite transition-colors hover:bg-paper-warm"
        >
          <Printer className="h-3.5 w-3.5" aria-hidden />
          打印
        </button>
      </div>

      {saved && (
        <p className="mt-2 text-[12.5px] leading-[1.5] text-kraft-deep">{saved}</p>
      )}

      <p className="mt-2 text-[12.5px] leading-[1.5] text-graphite-soft">
        谱面是从这份 MIDI 量化出来的：每个音被吸到最近的十六分音符格子上，跨小节的音会被
        切开。要照着原曲练，请以上面的播放为准。
      </p>
    </div>
  );
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}
