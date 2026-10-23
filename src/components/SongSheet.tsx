"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FolderOpen, Maximize2, Minimize2, Pencil, Trash2, X } from "lucide-react";
import { Keyboard } from "./Keyboard";
import { Staff } from "./Staff";
import { Roll, clock } from "./Roll";
import { FavouriteButton, LevelMarks, Meter, PlayControl, PractiseButton, usePlayback } from "./kit";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { durationOf, loadNotes, type Note } from "@/lib/audio";
import { revealMidi } from "@/lib/storage";
import {
  midiSource,
  howToStart,
  keyInWords,
  lastPlayedLine,
  level,
  normaliseKey,
  practiceTime,
  summaryLine,
  tempoInWords,
  timeSignatureInWords,
  type Piece,
} from "@/lib/piece";

/**
 * A song, opened over the book: the page lifted off the board.
 *
 * At rest the page is a survey — the shape of the piece drawn out, and every
 * key it touches inked on the keyboard. Press play and the survey clears: the
 * keyboard becomes the instrument, lighting the notes as they sound in the
 * colour of the hand that plays them. Same two pictures, two states.
 *
 * Dialog behaviour — focus trap, restore, Escape, scroll lock, aria wiring — is
 * Radix's rather than hand-rolled: it is the part that is easy to get subtly
 * wrong and pointless to own.
 */
/**
 * 谱面按需加载。
 *
 * VexFlow 连同它的字形表有一兆多，但 Tauri 的自定义协议在运行时拉动态分块会把
 * 五线谱视图整页带崩（"Failed to fetch dynamically imported module"），所以这里改成
 * 静态引入——桌面端从磁盘加载这点体积无所谓，换来的是点开谱子不再白屏。
 */

export function SongSheet({
  piece,
  onClose,
  onPatch,
  onDelete,
  onPractise,
  practising = false,
  logged = false,
}: {
  piece: Piece;
  onClose: () => void;
  onPatch: (patch: Partial<Piece>) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  /** Shared with every other surface, so a session is logged the same way. */
  onPractise: () => void | Promise<void>;
  practising?: boolean;
  logged?: boolean;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  /** 卷帘与谱面共用同一个音符数组，只是两种看法。 */
  const [view, setView] = useState<"roll" | "staff">("roll");
  /** 谱面的全屏：右边那栏（怎么下手、难度、笔记）收起来，谱面摊满整个页面。 */
  const [staffFull, setStaffFull] = useState(false);

  const source = midiSource(piece);
  const playback = usePlayback(piece.id, source);
  const playing = playback.state === "playing";

  // The roll draws the notes that will actually be played, not the sampled-down
  // map the thumbnails use, so it reads the same file playback does. The read
  // is cached, so pressing play costs nothing extra after this.
  const [notes, setNotes] = useState<Note[] | null>(null);
  useEffect(() => {
    let live = true;
    void loadNotes(source)
      .then((n) => live && setNotes(n))
      .catch(() => live && setNotes([]));
    return () => {
      live = false;
    };
  }, [source]);
  const rollDuration = notes ? durationOf(notes) : piece.duration_seconds;

  const lvl = level(piece.difficulty);
  const steps = howToStart(piece);
  // Which key, and which hand plays it, from the same source the roll reads.
  const used = useMemo(() => {
    const map = new Map<number, 0 | 1>();
    for (const [, midi, , hand] of piece.pitch_map) {
      map.set(midi, hand === 0 || hand === 1 ? hand : midi >= 60 ? 1 : 0);
    }
    return map;
  }, [piece.pitch_map]);

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        ref={sheet}
        // Opening a dialog puts focus on its first control, which here is the
        // close button: a stray Space or Enter then threw the page away. Focus
        // the sheet itself instead, so the first key you press acts on the song
        // rather than dismissing it. Tab still reaches everything.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          sheet.current?.focus();
        }}
        // Space is the transport key once a song is open, the way it is in
        // every player. It stays out of the way on a control that already does
        // something with it: a button, a link, or a field you are typing in.
        onKeyDown={(e) => {
          if (e.key !== " " && e.code !== "Space") return;
          const target = e.target as HTMLElement | null;
          if (target?.closest("button, a, input, textarea, select, [contenteditable='true']")) {
            return;
          }
          e.preventDefault();
          playback.toggle();
        }}
      >
        {/* ---- the head of the page ---- */}
        <header className="page-part flex shrink-0 flex-wrap items-start gap-x-4 gap-y-3 border-b border-rule px-4 py-4 md:flex-nowrap md:gap-5 md:px-8 md:pt-5">
          <div className="order-1 min-w-0 flex-1">
            {/* A file carries whatever name its maker typed into it, which is
                often the instrument rather than the piece. The heading stays
                mounted while it is being corrected so the dialog keeps its
                name; it is only taken off the page visually. */}
            <DialogTitle
              className={
                renaming
                  ? "sr-only"
                  : "font-book text-[clamp(1.35rem,6vw,2.1rem)] font-medium leading-[1.12] tracking-[-0.018em] text-graphite"
              }
            >
              {piece.title}
            </DialogTitle>

            {renaming ? (
              <form
                className="flex flex-col gap-2"
                // Escape belongs to the correction while one is open, not to
                // the sheet underneath it.
                onKeyDown={(e) => {
                  if (e.key !== "Escape") return;
                  e.stopPropagation();
                  setRenaming(false);
                }}
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  const title = String(form.get("title") ?? "").trim();
                  const composer = String(form.get("composer") ?? "").trim();
                  setRenaming(false);
                  if (title === piece.title && composer === (piece.composer ?? "")) return;
                  onPatch({
                    ...(title ? { title } : {}),
                    composer: composer || null,
                  });
                }}
              >
                <Input
                  name="title"
                  defaultValue={piece.title}
                  aria-label="这首曲子的名字"
                  autoFocus
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-11 font-book text-[19px] md:text-[21px]"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    name="composer"
                    defaultValue={piece.composer ?? ""}
                    placeholder="作曲者，知道的就写上"
                    aria-label="作曲者"
                    className="h-9 w-full min-w-0 flex-1 sm:w-auto"
                  />
                  <Button type="submit" variant="paper" size="sm">
                    Save the name
                  </Button>
                  <Button
                    type="button"
                    variant="quiet"
                    size="sm"
                    onClick={() => setRenaming(false)}
                  >
                    Leave it
                  </Button>
                </div>
              </form>
            ) : (
              <DialogDescription className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[13.5px] text-graphite-soft md:mt-1.5 md:text-[14px]">
                <span>{piece.composer ?? "作曲者不详"}</span>
                <Button
                  variant="quiet"
                  size="sm"
                  className="h-7 px-1.5 [&_svg]:size-[13px]"
                  onClick={() => setRenaming(true)}
                  aria-label={`Correct the name of ${piece.title}`}
                >
                  <Pencil />
                  Rename
                </Button>
                <span aria-hidden className="hidden text-rule sm:inline">
                  |
                </span>
                <span className="flex items-center gap-2">
                  <LevelMarks level={piece.difficulty} />
                  {summaryLine(piece)}
                </span>
              </DialogDescription>
            )}
          </div>

          {/* The bookmark travels with the close button rather than sitting
              between the two things you opened this page to do. */}
          <div className="order-2 flex shrink-0 items-center gap-1 md:order-3">
            <FavouriteButton
              favourite={piece.is_favourite}
              title={piece.title}
              onToggle={() => onPatch({ is_favourite: !piece.is_favourite })}
            />
            <DialogClose asChild>
              <Button variant="quiet" size="icon" aria-label="关闭，回到曲目册">
                <X />
              </Button>
            </DialogClose>
          </div>

          <div className="order-3 flex w-full flex-wrap items-center gap-2 md:order-2 md:w-auto md:flex-nowrap">
            <PractiseButton
              title={piece.title}
              onPractise={onPractise}
              busy={practising}
              done={logged}
              size="large"
              className="basis-full md:basis-auto"
            />
            <PlayControl
              state={playback.state}
              title={piece.title}
              onToggle={playback.toggle}
              size="large"
              className="min-w-0 flex-1 md:flex-none"
            />
          </div>
        </header>

        {/* ---- two columns, both fitting ---- */}
        {/* 谱面全屏时右栏整个退场，左栏拿满整行——看谱要的是宽度，不是两栏。 */}
        <div
          className={`min-h-0 flex-1 overflow-y-auto ${
            staffFull && view === "staff"
              ? "lg:grid lg:grid-cols-1 lg:overflow-hidden"
              : "lg:grid lg:grid-cols-[1.15fr_1fr] lg:overflow-hidden"
          }`}
        >
          <div
            className="page-part squared flex min-h-0 flex-col gap-4 border-rule px-4 py-4 md:gap-5 md:px-8 md:py-5 lg:overflow-y-auto lg:border-r"
            style={{ animationDelay: "70ms" }}
          >
            <figure className="m-0">
              <Keyboard
                used={used}
                active={playback.active}
                playing={playing}
                className="h-28 w-full md:h-32"
                showLandmarks={!playing}
              />
              <figcaption className="mt-2 text-[12.5px] leading-[1.5] text-graphite-soft">
                {playing
                  ? "正在播放：鎏金是右手，墨色是左手。"
                  : "它碰过的每一个键都在上面。键下面那道标记是中央 C。按播放，键盘会跟着弹。"}
              </figcaption>
            </figure>

            <figure className="m-0">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div className="inline-flex overflow-hidden rounded-[5px] border border-rule">
                  <button
                    type="button"
                    onClick={() => setView("roll")}
                    aria-pressed={view === "roll"}
                    className={`px-2.5 py-1 font-label text-[12.5px] font-semibold transition-colors ${
                      view === "roll" ? "bg-kraft text-graphite" : "bg-paper text-graphite-soft hover:bg-paper-warm"
                    }`}
                  >
                    琴卷图
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("staff")}
                    aria-pressed={view === "staff"}
                    className={`px-2.5 py-1 font-label text-[12.5px] font-semibold transition-colors ${
                      view === "staff" ? "bg-kraft text-graphite" : "bg-paper text-graphite-soft hover:bg-paper-warm"
                    }`}
                  >
                    五线谱
                  </button>
                </div>

                {view === "staff" && (
                  <button
                    type="button"
                    onClick={() => setStaffFull((full) => !full)}
                    aria-pressed={staffFull}
                    title={staffFull ? "退出全屏，找回右边的笔记" : "全屏看谱，右边一栏先收起来"}
                    className="inline-flex items-center gap-1.5 rounded-[5px] border border-rule bg-paper px-2.5 py-1 font-label text-[12.5px] font-semibold text-graphite transition-colors hover:bg-paper-warm"
                  >
                    {staffFull ? (
                      <>
                        <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                        退出全屏
                      </>
                    ) : (
                      <>
                        <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                        全屏
                      </>
                    )}
                  </button>
                )}
              </div>

              {!notes ? (
                <Skeleton className="h-[150px] w-full rounded-[2px] md:h-[188px]" />
              ) : view === "roll" ? (
                <Roll
                  notes={notes}
                  duration={rollDuration}
                  position={playback.transport.position}
                  onSeek={playback.seekTo}
                  className="h-[150px] w-full md:h-[188px]"
                />
              ) : (
                <Staff
                  notes={notes}
                  title={piece.title}
                  bpm={piece.tempo_bpm}
                  timeSignature={piece.time_signature}
                  keySignature={piece.key_signature}
                  twoHands={piece.two_hands}
                  position={playback.transport.position}
                  onSeek={playback.seekTo}
                />
              )}

              <figcaption className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] leading-[1.5] text-graphite-soft">
                {view === "roll" ? (
                  <>
                    <span className="tabular-nums">
                      {clock(playback.transport.position)} / {clock(rollDuration)}
                    </span>
                    <span>
                      整首曲子都在这一条里。点任意位置就从那里弹起，或者按
                      <kbd className="mx-1 rounded-[3px] border border-rule px-1 py-px text-[11.5px] font-medium">
                        空格
                      </kbd>
                      开始与停下。
                    </span>
                  </>
                ) : (
                  <span>
                    点任意小节，播放就从那里弹起，正在弹的小节会亮起来。
                    {staffFull
                      ? "全屏中——右边的笔记先收着，点「退出全屏」找回。"
                      : "要更大的纸面就点「全屏」。"}
                  </span>
                )}
              </figcaption>
            </figure>

            <dl className="mt-auto grid grid-cols-1 items-start gap-x-7 gap-y-3 border-t border-rule pt-4 sm:grid-cols-3">
              {/* midi.ts infers a key when the file declares none, and said the
                  interface always labels that. It did not. A guessed key that
                  looks like a read one is the exact thing the rest of this page
                  is built not to do. */}
              <Fact
                term="Key"
                tag={piece.key_signature && piece.key_is_estimated ? "我们的推断" : undefined}
                value={normaliseKey(piece.key_signature) ?? "未标注"}
                plain={
                  piece.key_signature && piece.key_is_estimated
                    ? `Worked out from the notes — ${keyInWords(piece.key_signature)}`
                    : keyInWords(piece.key_signature)
                }
              />
              <Fact
                term="Speed"
                value={piece.tempo_bpm ? `${piece.tempo_bpm} bpm` : "未标注"}
                plain={
                  piece.tempo_bpm ? tempoInWords(piece.tempo_bpm) : "按你自己稳得住的速度弹"
                }
              />
              <Fact
                term="Count"
                value={piece.time_signature ?? "未标注"}
                plain={timeSignatureInWords(piece.time_signature)}
              />
            </dl>
          </div>

          <div
            className={`page-part flex min-h-0 flex-col gap-5 bg-paper-warm px-4 py-4 md:gap-6 md:px-8 md:py-5 lg:overflow-y-auto ${
              staffFull && view === "staff" ? "hidden" : ""
            }`}
            style={{ animationDelay: "130ms" }}
          >
            <section>
              <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.11em] text-graphite-soft">
                怎么下手
              </h3>
              <ol className="mt-3 space-y-3.5">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span
                      aria-hidden
                      className="mt-[3px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-kraft text-[12.5px] font-bold text-graphite"
                    >
                      {i + 1}
                    </span>
                    <p className="font-book text-[15px] leading-[1.6] text-graphite">{step}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="border-t border-rule pt-4">
              <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.11em] text-graphite-soft">
                Why we call it {lvl.name.toLowerCase()}
              </h3>
              <p className="mt-1 text-[12.5px] text-graphite-soft">
                每一行都是和你曲目册里所有曲子比出来的十分制。
              </p>
              <dl className="mt-2.5 space-y-2">
                {piece.difficulty_factors.map((factor) => (
                  <div
                    key={factor.key}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 text-[13px] sm:grid-cols-[minmax(0,1fr)_auto_10.5rem]"
                    role="img"
                    aria-label={`${factor.label}: ${factor.reading}`}
                  >
                    <dt className="truncate text-graphite">{factor.label}</dt>
                    <Meter value={factor.weight} className="translate-y-[1px]" />
                    <dd className="col-span-2 text-right tabular-nums text-graphite-soft sm:col-span-1">
                      {factor.reading}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2.5 text-[12.5px] leading-[1.5] text-graphite-soft">
                All measured from the file, so the rating is never something to take on trust.
              </p>
            </section>

            {/* Everything above this line was read out of the file. This is the
                one part of the page the file cannot know: the bar that keeps
                going wrong, the fingering you settled on. Saved on blur, because
                a note you have to remember to save is a note you lose. */}
            <section className="border-t border-rule pt-3.5">
              {/* Label and hint share a line: the hint is one short phrase, and
                  giving it a row of its own cost more height than it was worth. */}
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <label
                  htmlFor="piece-notes"
                  className="text-[12.5px] font-semibold uppercase tracking-[0.11em] text-graphite-soft"
                >
                  Your notes
                </label>
                <span className="text-[12px] text-graphite-soft">
                  {noteSaved ? "已保存。" : "点到别处就会存下来"}
                </span>
              </div>
              <textarea
                id="piece-notes"
                defaultValue={piece.notes ?? ""}
                rows={2}
                placeholder="第 24 小节左手要从右手上越过——这一段慢下来练。"
                onBlur={async (e) => {
                  const next = e.currentTarget.value.trim();
                  if (next === (piece.notes ?? "")) return;
                  await onPatch({ notes: next || null });
                  setNoteSaved(true);
                  window.setTimeout(() => setNoteSaved(false), 2000);
                }}
                className="mt-1.5 w-full resize-y rounded-[3px] border border-rule bg-paper px-3 py-1.5 font-book text-[15px] leading-[1.5] text-graphite shadow-[inset_0_1px_2px_rgba(42,24,14,0.06)] transition-colors placeholder:text-graphite-soft/70 hover:border-graphite-soft focus-visible:border-kraft-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-kraft-deep"
              />
            </section>
          </div>
        </div>

        {/* ---- foot ---- */}
        <footer
          className="page-part flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule bg-sheet px-4 py-2.5 md:px-8 md:py-3"
          style={{ animationDelay: "190ms" }}
        >
          {confirming ? (
            <>
              <p className="text-[14px] text-graphite">
                Remove <strong className="font-semibold">{piece.title}</strong>? The file goes too.
              </p>
              <div className="ml-auto flex items-center gap-2.5">
                <Button variant="paper" onClick={() => setConfirming(false)}>
                  Keep it
                </Button>
                <Button
                  variant="board"
                  busy={removing}
                  onClick={async () => {
                    setRemoving(true);
                    try {
                      await onDelete();
                    } finally {
                      // On success the sheet closes and this never lands; on
                      // failure the piece comes back and so must the button.
                      setRemoving(false);
                    }
                  }}
                >
                  Yes, remove it
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[13px] text-graphite-soft">
                {lastPlayedLine(piece.last_practiced_at)}
                {piece.session_count > 0 &&
                  ` · ${piece.session_count} sessions · ${practiceTime(piece.practice_seconds)}`}
              </p>
              <div className="ml-auto flex items-center gap-1">
                {/* Not a download: the file is already on this machine, in the
                    folder beside the database. What a person wants here is to
                    find it. */}
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={() => void revealMidi(piece.storage_path)}
                  title={piece.source_filename}
                >
                  <FolderOpen />
                  Show file
                </Button>
                <Button variant="quiet" size="sm" onClick={() => setConfirming(true)}>
                  <Trash2 />
                  Remove
                </Button>
              </div>
            </>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function Fact({
  term,
  value,
  plain,
  tag,
}: {
  term: string;
  value: string;
  plain: string;
  /** Marks a reading the file did not give us, so it never passes as one. */
  tag?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex flex-wrap items-center gap-x-1.5 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-graphite-soft">
        {term}
        {tag && (
          <span className="rounded-[2px] bg-kraft px-1.5 py-px text-[10.5px] tracking-[0.08em] text-graphite">
            {tag}
          </span>
        )}
      </dt>
      <dd>
        <p className="truncate font-book text-[17px] font-medium text-graphite">{value}</p>
        <p className="mt-0.5 text-[12.5px] leading-[1.45] text-graphite-soft">{plain}</p>
      </dd>
    </div>
  );
}
