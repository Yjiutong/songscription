"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, ImagePlus, Loader2, RefreshCw, Trash2, X } from "lucide-react";
import { LevelMarks } from "@/components/kit";
import { deletePiece, updatePiece } from "@/lib/db";
import type { Piece } from "@/lib/piece";
import { durationInWords } from "@/lib/piece";
import { getPlatform } from "@/lib/platform";
import type { OutputFile, Platform } from "@/lib/platform/types";
import type { SheetFormat } from "@/lib/staff-pages";
import { useAppearance } from "@/lib/appearance";
// 排版库（VexFlow、@tonejs/midi 等一兆多）。Tauri 的自定义协议在运行时
// import() 分块会把导出整页带崩，所以直接从顶部静态引入，导出时直接用。
import * as notation from "@/lib/notation";
import * as render from "@/lib/staff-render";
import * as pages from "@/lib/staff-pages";
import * as audio from "@/lib/audio";

/**
 * 设置。
 *
 * 这里放的是那些"不是曲子的事"：封面换成哪张画、印出来的谱放到哪个文件夹、
 * 已经印出来的那些还要不要。它们理在一行 SQL 里也一样能存，但放在一起才
 * 找得着——一个人要换背景的时候，不会指望先点开某一首曲子。
 */

const FORMATS: { value: SheetFormat; label: string; note: string }[] = [
  { value: "png", label: "PNG", note: "无损，适合贴图和再加工" },
  { value: "jpg", label: "JPG", note: "体积小，适合发给别人" },
  { value: "pdf", label: "PDF", note: "一册一个文件，适合打印" },
];

const DPIS = [200, 300];
const PER_LINE = [3, 4, 5, 6];

export type SettingsProps = {
  pieces: Piece[];
  onClose(): void;
  /** 删掉一首之后，外面的架子得跟着少一格。 */
  onRemoved(): void;
  onOpenPiece(id: string): void;
};

export function Settings({ pieces, onClose, onRemoved, onOpenPiece }: SettingsProps) {
  const appearance = useAppearance();
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [dir, setDir] = useState<string>("");
  const [files, setFiles] = useState<OutputFile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  // 导出偏好存在曲目册旁边，而不是 localStorage——换一台机器的时候，这两样
  // 应当一起走。
  const [format, setFormat] = useState<SheetFormat>("png");
  const [dpi, setDpi] = useState(300);
  const [perLine, setPerLine] = useState(4);

  const [location, setLocation] = useState<string>("");
  const filePicker = useRef<HTMLInputElement>(null);
  const [dirDraft, setDirDraft] = useState<string>("");

  const refreshFiles = useCallback(async () => {
    if (!platform?.output.manageable) return;
    setFiles(await platform.output.list());
  }, [platform]);

  useEffect(() => {
    let live = true;
    void (async () => {
      const found = await getPlatform();
      const saved = await found.settings.all();
      const current = await found.output.dir();
      const listed = found.output.manageable ? await found.output.list() : [];
      if (!live) return;
      setPlatform(found);
      setDir(current);
      setDirDraft(current);
      setFiles(listed);
      if (typeof saved["sheet.format"] === "string") setFormat(saved["sheet.format"] as SheetFormat);
      if (typeof saved["sheet.dpi"] === "number") setDpi(saved["sheet.dpi"] as number);
      if (typeof saved["sheet.perLine"] === "number") setPerLine(saved["sheet.perLine"] as number);
      setLocation(await found.location());
    })();
    return () => {
      live = false;
    };
  }, []);

  const remember = useCallback(
    async (key: string, value: unknown) => {
      if (!platform) return;
      await platform.settings.set(key, value);
    },
    [platform],
  );

  // --- 背景图 -------------------------------------------------------------

  const pickBackground = async (file: File | undefined) => {
    if (!file) return;
    setFailure(null);
    setNotice(null);
    if (!file.type.startsWith("image/")) {
      setFailure(`"${file.name}" 不是图片。传一张 jpg、png 或 webp。`);
      return;
    }
    setBusy("background");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await appearance.setImage(bytes, file.type);
      setNotice("封面换好了。");
    } catch (error) {
      setFailure(cause(error));
    } finally {
      setBusy(null);
    }
  };

  // --- 导出 ---------------------------------------------------------------

  const exportPiece = async (piece: Piece) => {
    if (!platform) return;
    setFailure(null);
    setNotice(null);
    setBusy(piece.id);
    try {
      // 排版库已在顶部静态引入（Tauri 自定义协议下运行时 import() 会整页带崩），
      // 这里直接用。
      const notes = await audio.loadNotes(piece.storage_path);
      if (notes.length === 0) {
        setFailure(`《${piece.title}》这个文件里没有音符。`);
        return;
      }
      const score = notation.buildScore(notes, {
        bpm: piece.tempo_bpm,
        timeSignature: piece.time_signature,
        twoHands: piece.two_hands,
      });
      const singleClef: "treble" | "bass" = clefOf(notes);
      const base = {
        score,
        layout: { width: 1000, measuresPerLine: perLine, singleClef },
        key: render.vexKeyOf(piece.key_signature),
        upTo: score.measures.length,
      };

      const written = await pages.renderSheetFiles(
        base,
        {
          title: piece.title,
          key: pages.keyLabel(piece.key_signature),
          timeSignature: piece.time_signature,
          bpm: piece.tempo_bpm,
        },
        { dpi, measuresPerLine: perLine, format, upTo: score.measures.length },
      );

      for (const file of written.files) {
        await platform.output.write(file.name, file.data);
      }
      await refreshFiles();
      setNotice(
        `《${piece.title}》导出 ${written.pages} 页，放在 ${dir} 里。`,
      );
    } catch (error) {
      setFailure(cause(error));
    } finally {
      setBusy(null);
    }
  };

  // --- 输出目录 -----------------------------------------------------------

  const browse = async () => {
    if (!platform) return;
    setFailure(null);
    const chosen = await platform.output.pick();
    if (chosen) await applyDir(chosen);
  };

  const applyDir = async (next: string) => {
    if (!platform) return;
    setBusy("dir");
    setFailure(null);
    try {
      await platform.output.set(next);
      const current = await platform.output.dir();
      setDir(current);
      setDirDraft(current);
      await refreshFiles();
      setNotice("输出目录改好了。");
    } catch (error) {
      setFailure(cause(error));
    } finally {
      setBusy(null);
    }
  };

  const confirmRemoval = async (name: string): Promise<boolean> => {
    // 删库可以重建，删错输出文件只是一张图——但删除按钮旁边就是"显示"，误点
    // 的代价是那个人重新排版一遍十七分钟的曲子。所以问一下。
    const yes = typeof window !== "undefined" && window.confirm(`删除「${name}」？`);
    if (!yes) return true;
    if (platform) await platform.output.remove(name);
    await refreshFiles();
    return false;
  };

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-board">
      {/* .board 只有纹理没有底色——底色是垫在最底下的 SiteBackground 给的。这一页
           盖在主界面上面，不自己铺一层漆地，主界面就会从字缝里透上来。 */}
      <div className="mx-auto w-full max-w-[1080px] px-4 pb-24 pt-5 md:px-8">
        <div className="mb-6 flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-book text-[26px] font-semibold leading-tight text-graphite">
              设置
            </h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-graphite-soft">
              曲目册放在 {location}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] border border-rule bg-paper text-graphite transition-colors hover:bg-paper-warm"
            aria-label="关闭设置"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        {failure && <Banner tone="bad" onDismiss={() => setFailure(null)}>{failure}</Banner>}
        {notice && <Banner tone="good" onDismiss={() => setNotice(null)}>{notice}</Banner>}

        {/* --- 封面 --- */}
        <Section title="封面" hint="换成你自己喜欢的画，顶上那条会跟着它变色">
          <div className="flex flex-wrap items-start gap-5">
            <div className="relative h-[104px] w-[180px] shrink-0 overflow-hidden rounded-[3px] border border-rule">
              {appearance.image ? (
                <img src={appearance.image} alt="当前封面" className="h-full w-full object-cover" />
              ) : (
                <div className="from-board-soft board flex h-full w-full items-end bg-gradient-to-br p-2">
                  <span className="font-book text-[12px] text-gold-soft">朱漆封面</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <RowButton onClick={() => filePicker.current?.click()} busy={busy === "background"}>
                <ImagePlus className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                {appearance.image ? "换一张" : "上传一张"}
              </RowButton>
              {appearance.image && (
                <RowButton danger onClick={() => void appearance.clearImage()}>
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  恢复朱漆封面
                </RowButton>
              )}
            </div>
            <input
              ref={filePicker}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                void pickBackground(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-graphite-soft">
            图会存在曲目册旁边的一个文件里，跟着册子一起搬；不上传的时候 App 用的是内置的朱漆封面。
          </p>
        </Section>

        {/* --- 导出 --- */}
        <Section title="导出偏好" hint="这里定了，下面每首曲子点一下就出">
          <Field label="格式">
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((option) => (
                <Choice
                  key={option.value}
                  active={format === option.value}
                  title={option.note}
                  onClick={() => {
                    setFormat(option.value);
                    void remember("sheet.format", option.value);
                  }}
                >
                  {option.label}
                </Choice>
              ))}
            </div>
          </Field>
          <Field label="清晰度">
            <div className="flex gap-2">
              {DPIS.map((value) => (
                <Choice
                  key={value}
                  active={dpi === value}
                  onClick={() => {
                    setDpi(value);
                    void remember("sheet.dpi", value);
                  }}
                >
                  {value} dpi
                </Choice>
              ))}
            </div>
          </Field>
          <Field label="每行小节数" hint="小节少则音符大，好认；小节多则一页装得多">
            <div className="flex gap-2">
              {PER_LINE.map((value) => (
                <Choice
                  key={value}
                  active={perLine === value}
                  onClick={() => {
                    setPerLine(value);
                    void remember("sheet.perLine", value);
                  }}
                >
                  {value}
                </Choice>
              ))}
            </div>
          </Field>
        </Section>

        {/* --- 输出目录 --- */}
        <Section title="输出文件夹" hint="印出来的谱面都堆在这里">
          <label htmlFor="output-dir" className="sr-only">
            输出文件夹
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="output-dir"
              value={dirDraft}
              onChange={(event) => setDirDraft(event.target.value)}
              className="min-w-[16rem] flex-1"
              placeholder="留空回到默认位置"
            />
            <RowButton onClick={() => void applyDir(dirDraft)} busy={busy === "dir"}>
              用这个文件夹
            </RowButton>
            {platform?.output.manageable && (
              <>
                <RowButton onClick={() => void browse()}>
                  <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  浏览…
                </RowButton>
                <RowButton onClick={() => void platform.output.openDir().catch(() => undefined)}>
                  打开
                </RowButton>
              </>
            )}
          </div>
          <p className="mt-2.5 break-all font-label text-[11.5px] leading-relaxed text-graphite-soft">
            现在用的是：{dir || "（还没定）"}
          </p>
        </Section>

        {/* --- 已经导出的文件 --- */}
        <Section
          title="已经导出的文件"
          hint={platform?.output.manageable ? undefined : "网页版管不了"}
          aside={
            platform?.output.manageable && (
              <RowButton compact onClick={() => void refreshFiles()}>
                <RefreshCw className="h-3 w-3" strokeWidth={2} aria-hidden />
                刷新
              </RowButton>
            )
          }
        >
          {!platform?.output.manageable ? (
            <p className="text-[12.5px] leading-relaxed text-graphite-soft">
              这一版跑在浏览器里，导出来的文件直接进了浏览器的下载文件夹，App 看不见也没法删。
              用 <code className="font-label">npm run desktop</code> 打开桌面应用，这里就是文件列表。
            </p>
          ) : files.length === 0 ? (
            <p className="text-[12.5px] leading-relaxed text-graphite-soft">
              还没有导出过东西。下面挑一首，点右边那个按钮试试。
            </p>
          ) : (
            <ul className="divide-y divide-rule border-y border-rule">
              {files.map((file) => (
                <li key={file.name} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-graphite">{file.name}</p>
                    <p className="mt-0.5 text-[11.5px] text-graphite-soft">
                      {size(file.bytes)} · {when(file.modified)}
                    </p>
                  </div>
                  <RowButton
                    compact
                    onClick={() => void platform.output.reveal(file.name).catch(() => undefined)}
                  >
                    显示
                  </RowButton>
                  <RowButton compact danger onClick={() => void confirmRemoval(file.name)}>
                    删除
                  </RowButton>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* --- 全部曲目 --- */}
        <Section title="曲目" hint={`一共 ${pieces.length} 首`}>
          {pieces.length === 0 ? (
            <p className="text-[12.5px] leading-relaxed text-graphite-soft">
              架子上还是空的。回主界面加一首。
            </p>
          ) : (
            <ul className="divide-y divide-rule border-y border-rule">
              {pieces.map((piece) => (
                <li key={piece.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onOpenPiece(piece.id)}
                      className="truncate text-left text-[13.5px] text-graphite transition-colors hover:text-kraft-deep"
                    >
                      {piece.title}
                    </button>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-graphite-soft">
                      <span>{piece.composer ?? "作曲者不详"}</span>
                      <span>·</span>
                      <span>{durationInWords(piece.duration_seconds)}</span>
                      <span>·</span>
                      <LevelMarks level={piece.difficulty} />
                    </p>
                  </div>
                  <RowButton compact busy={busy === piece.id} onClick={() => void exportPiece(piece)}>
                    导出
                  </RowButton>
                  <RowButton compact onClick={() => void toggleFavourite(piece, onRemoved)}>
                    {piece.is_favourite ? "取消收藏" : "收藏"}
                  </RowButton>
                  <RowButton compact danger onClick={() => void drop(piece, onRemoved)}>
                    删除
                  </RowButton>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

// --- 小零件 ---------------------------------------------------------------

/** 单手就用那一只的谱号：合起来的 MIDI 里没有"左手"这回事。 */
function clefOf(notes: { midi: number }[]): "treble" | "bass" {
  if (notes.length === 0) return "treble";
  const sorted = [...notes].map((note) => note.midi).sort((a, b) => a - b);
  return (sorted[Math.floor(sorted.length / 2)] ?? 60) < 57 ? "bass" : "treble";
}

async function toggleFavourite(piece: Piece, done: () => void) {
  await updatePiece(piece.id, { is_favourite: !piece.is_favourite });
  done();
}

async function drop(piece: Piece, done: () => void) {
  const yes =
    typeof window !== "undefined" &&
    window.confirm(`把《${piece.title}》从曲目册里删掉？它的 MIDI 文件也会一起删。`);
  if (!yes) return;
  await deletePiece(piece.id);
  done();
}

function cause(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "这一步没能做完。";
}

function Section({
  title,
  hint,
  aside,
  children,
}: {
  title: string;
  hint?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="sheet sheet-raised mb-5 px-5 py-4 md:px-6 md:py-5">
      <div className="mb-3.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-book text-[16px] font-semibold text-graphite">{title}</h2>
        {hint && <p className="text-[12px] text-graphite-soft">{hint}</p>}
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3.5 last:mb-0">
      <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2">
        <span className="font-label text-[12px] font-semibold uppercase tracking-[0.08em] text-graphite-soft">
          {label}
        </span>
        {hint && <span className="text-[11.5px] text-graphite-soft">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Choice({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick(): void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`rounded-[3px] border px-2.5 py-1 font-label text-[12.5px] transition-colors ${
        active
          ? "border-kraft-deep bg-kraft text-graphite"
          : "border-rule bg-paper text-graphite-soft hover:bg-paper-warm hover:text-graphite"
      }`}
    >
      {children}
    </button>
  );
}

function RowButton({
  onClick,
  busy,
  danger,
  compact,
  children,
}: {
  onClick(): void;
  busy?: boolean;
  danger?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-[3px] border font-label font-semibold transition-colors disabled:opacity-55 ${
        compact
          ? "px-2 py-[3px] text-[11.5px]"
          : "px-2.5 py-1 text-[12.5px]"
      } ${
        danger
          ? "border-rule bg-paper text-graphite hover:border-[#8C2622] hover:bg-[#8C2622] hover:text-paper"
          : "border-rule bg-paper text-graphite hover:bg-paper-warm"
      }`}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden /> : null}
      {children}
    </button>
  );
}

function Banner({
  tone,
  onDismiss,
  children,
}: {
  tone: "good" | "bad";
  onDismiss(): void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mb-4 flex items-start gap-3 rounded-[3px] border px-3.5 py-2.5 text-[12.5px] leading-relaxed ${
        tone === "good"
          ? "border-kraft-deep bg-sheet text-graphite"
          : "border-[#8C2622] bg-sheet text-graphite"
      }`}
    >
      <span className="flex-1">{children}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="关掉"
        className="mt-0.5 text-graphite-soft transition-colors hover:text-graphite"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

function Input({
  className = "",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={`rounded-[3px] border border-rule bg-paper px-2.5 py-1 font-label text-[12.5px] text-graphite transition-colors placeholder:text-graphite-soft/70 focus:border-kraft-deep focus:outline-none ${className}`}
    />
  );
}

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function when(seconds: number): string {
  if (!seconds) return "时间不详";
  const ago = Date.now() / 1000 - seconds;
  if (ago < 90) return "刚刚";
  if (ago < 5400) return `${Math.round(ago / 60)} 分钟前`;
  if (ago < 86400 * 2) return `${Math.round(ago / 3600)} 小时前`;
  return new Date(seconds * 1000).toLocaleDateString("zh-CN");
}
