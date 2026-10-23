"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, Rows3, Search, Star, X } from "lucide-react";
import { FavouriteButton, LevelMarks, PlayButton, PractiseButton } from "./kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RevealButton } from "@/components/ui/button-6";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CARD_GRID, HEADER_BAR, PAGE_SHELL, TOOLBAR_BAR } from "@/lib/utils";
import { deletePiece, listPieces, updatePiece } from "@/lib/db";
import { getPlatform } from "@/lib/platform";
import { removeMidi } from "@/lib/storage";
import { PitchMap } from "./PitchMap";
import { SongCard, SongRow, Summary } from "./SongCard";
import { SongSheet } from "./SongSheet";
import { AddSong } from "./AddSong";
import { Settings } from "./Settings";
import { Shortcuts } from "./Shortcuts";
import { TopBar } from "./TopBar";
import {
  midiSource,
  lastPractised,
  level,
  lastPlayedLine,
  LEVELS,
  matches,
  suggestions,
  type Piece,
  type Suggestion,
} from "@/lib/piece";

/**
 * How many songs are drawn before the "show more" line.
 *
 * Not a guess: at 300 cards the page was 41,000 SVG rects and every keystroke
 * in the search box cost 400ms, because typing re-renders the whole grid. The
 * note drawings are the point of this library, so the answer is to draw fewer
 * of them, not to draw them worse. 48 fills three columns evenly.
 */
const PAGE = 48;

/**
 * Below this many songs, a filter is a control with nothing to do. An empty
 * book was still offering a search box, and three songs came with four ways to
 * narrow them — the tools have to arrive when the problem does.
 */
const NEEDS_NARROWING = 8;

type Sort = "recent" | "recently-played" | "longest-untouched" | "shortest" | "easiest" | "az";

const SORTS: { key: Sort; label: string }[] = [
  { key: "recent", label: "最新加入" },
  { key: "recently-played", label: "最近练过" },
  { key: "longest-untouched", label: "最久没练" },
  { key: "shortest", label: "时长最短" },
  { key: "easiest", label: "最容易" },
  { key: "az", label: "按名称" },
];

export function Library({ initial }: { initial: Piece[] }) {
  const [pieces, setPieces] = useState<Piece[]>(initial);
  const [query, setQuery] = useState("");
  const [hardness, setHardness] = useState<number | "all">("all");
  const [onlyFavourites, setOnlyFavourites] = useState(false);
  const [view, setView] = useState<"grid" | "ribbon">("grid");
  const [finishing, setFinishing] = useState(false);
  // Keyed by piece rather than a single flag: the same act is now offered from
  // the desk, every card, every row and the shelf, and two of them can be on
  // screen at once.
  const [practisingId, setPractisingId] = useState<string | null>(null);
  const [loggedId, setLoggedId] = useState<string | null>(null);

  // Restored after mount rather than during render, so the server and the first
  // client paint agree and nothing flashes the wrong layout.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("songscription:view");
      if (saved === "grid" || saved === "ribbon") setView(saved);
    } catch {
      // private window, or storage blocked: the default is fine
    }
  }, []);

  function chooseView(next: "grid" | "ribbon") {
    setView(next);
    try {
      window.localStorage.setItem("songscription:view", next);
    } catch {
      // nothing to do; the choice just will not outlive the session
    }
  }
  const [sort, setSort] = useState<Sort>("recent");
  const [openId, setOpenId] = useState<string | null>(null);

  // 顶上那条的三个图标管的都是这一页自己的开关：╡ tools 收不收、搜索框有没有
  // 抓在手里、是不是正在筛。它们是状态而不是装饰，所以点在 návrh 上要有反映。
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [asideOpen, setAsideOpen] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);
  // 筛选面板：顶栏第三个图标弹出来的那块。开关归这里，内容在下面。
  const [filterOpen, setFilterOpen] = useState(false);

  // 设置页删了东西之后，这一页的架子要跟着少一格。重新读一遍是最省事也最不会
  // 漏的办法：一个人一辈子上传多少曲子，也不至于让他等。
  const reloadPieces = async () => {
    try {
      setPieces(await listPieces());
    } catch {
      // 读不回来就保留眼前这一版，下一次点开再说。
    }
  };

  const openFolder = async (which: "catalogue" | "output") => {
    const platform = await getPlatform();
    await (which === "output" ? platform.output.openDir() : platform.openLocation());
  };

  // 顶栏第三个图标弹出来的那块。工具栏里那组筛选只在一首曲子够多的时候才露面，
  // 这一块不一样：从第一首起就在，因为"按难度翻一翻"从来不问藏书多少。
  const filterPanel = (
    <div className="w-[15.5rem] rounded-[4px] border border-rule bg-paper p-3.5 shadow-[0_10px_28px_-8px_rgba(20,12,6,0.45)]">
      <p className="font-label text-[11.5px] font-semibold uppercase tracking-[0.08em] text-graphite-soft">
        难度
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <FilterChip
          active={hardness === "all"}
          onClick={() => setHardness("all")}
          label="不限"
        />
        {LEVELS.map((l) => (
          <FilterChip
            key={l.level}
            active={hardness === l.level}
            onClick={() => setHardness((current) => (current === l.level ? "all" : l.level))}
            label={l.name}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-rule pt-3">
        <FilterChip
          active={onlyFavourites}
          onClick={() => setOnlyFavourites((value) => !value)}
          label="只看收藏"
        />
        {(onlyFavourites || hardness !== "all") && (
          <button
            type="button"
            onClick={() => {
              setHardness("all");
              setOnlyFavourites(false);
            }}
            className="font-label text-[12px] text-graphite-soft underline decoration-rule underline-offset-2 transition-colors hover:text-kraft-deep"
          >
            清除筛选
          </button>
        )}
      </div>
    </div>
  );

  const open = pieces.find((p) => p.id === openId) ?? null;
  const search = useRef<HTMLInputElement>(null);

  // Everything you have put on the desk, most recently touched first. More than
  // one is normal — people learn two pieces at once — and the page used to show
  // the top sheet as though it were the only one.
  const onTheDesk = useMemo(
    () => pieces.filter((p) => p.in_progress).sort((a, b) => when(b) - when(a)),
    [pieces],
  );
  // Which sheet of the stack is face up. Clamped on read rather than corrected
  // in an effect, so finishing the last piece on the desk cannot leave the
  // index pointing past the end for a frame.
  const [deskIndex, setDeskIndex] = useState(0);
  const deskPos = Math.min(deskIndex, Math.max(0, onTheDesk.length - 1));
  const current = onTheDesk[deskPos] ?? null;

  const flip = useCallback(
    (delta: number) =>
      setDeskIndex((i) => {
        const n = onTheDesk.length;
        if (n < 2) return 0;
        const from = Math.min(i, n - 1);
        return (from + delta + n) % n;
      }),
    [onTheDesk.length],
  );

  // Ctrl/Cmd+F and "/" go to the search box. Finding a song is what "find"
  // means on this page, so taking the shortcut is the honest thing to do.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement &&
        (e.target.tagName === "INPUT" ||
          e.target.tagName === "TEXTAREA" ||
          e.target.isContentEditable);
      const findKey = (e.key === "f" || e.key === "F") && (e.metaKey || e.ctrlKey);
      const slash = e.key === "/" && !e.metaKey && !e.ctrlKey && !typing;

      // Left and right walk the desk, the way you would thumb a stack of cards.
      // Only when there is a stack, only when nothing is open over the page,
      // and never while someone is typing into a field.
      const arrow = (e.key === "ArrowLeft" || e.key === "ArrowRight") && !typing;
      if (arrow && !openId && onTheDesk.length > 1) {
        e.preventDefault();
        flip(e.key === "ArrowRight" ? 1 : -1);
        return;
      }

      // Ctrl/Cmd+, opens settings: what every other application on the machine
      // has meant by it for twenty years.
      if (e.key === "," && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSettingsOpen((v) => !v);
        return;
      }

      if (!findKey && !slash) return;
      if (openId) return;
      e.preventDefault();
      search.current?.focus();
      search.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, flip, onTheDesk.length]);

  // Below four songs the whole book fits on one screen, and a shelf pointing at
  // three of them is just the same grid twice. It also stands down while you
  // are searching: you already know what you are looking for.
  const picks = useMemo(
    () =>
      pieces.length < 4 || query.trim() ? [] : suggestions(pieces, current?.id),
    [pieces, current, query],
  );

  // Reset when the matching set changes — not on sort, which reorders the same
  // songs and has no business throwing away what you have already scrolled.
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [query, hardness, onlyFavourites]);

  /**
   * Search runs in both places on purpose.
   *
   * The first keystroke filters the rows already in memory, so typing never
   * waits for the database. A debounced query then asks the catalogue itself,
   * which — unlike the array in memory — can see rows this view never loaded.
   * Local paints, the database decides. At this library's size the two agree
   * and you see nothing; past the point where the grid stops holding
   * everything, the query is the only one of the two that is right.
   *
   * There is no network to cancel here, so a `live` flag is enough to stop a
   * slower answer overwriting a newer one.
   */
  const [remote, setRemote] = useState<Piece[] | null>(null);
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setRemote(null);
      return;
    }
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const rows = await listPieces(q);
        if (live) setRemote(rows);
      } catch {
        // The local matches are already on screen, so there is nothing to say.
      }
    }, 180);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  const shown = useMemo(() => {
    // When the query has answered, its rows ARE the match set — but prefer the
    // local copy of any row we also hold, so a favourite toggled a moment ago
    // does not flicker back to its pre-click state.
    const local = new Map(pieces.map((p) => [p.id, p]));
    const base = remote ? remote.map((r) => local.get(r.id) ?? r) : pieces;
    return base
      .filter((p) => {
        if (onlyFavourites && !p.is_favourite) return false;
        if (hardness !== "all" && p.difficulty !== hardness) return false;
        // The query has already matched its rows; local ones still have to earn it.
        return remote ? true : matches(p, query);
      })
      .sort(comparators[sort]);
  }, [pieces, remote, query, hardness, sort, onlyFavourites]);

  /**
   * The click lands first and the write follows, because a bookmark that waits
   * on the database feels broken. If the write does not land, the row goes back
   * to what it was.
   */
  async function patch(piece: Piece, changes: Partial<Piece>) {
    const next = { ...piece, ...changes };
    setPieces((c) => c.map((p) => (p.id === piece.id ? next : p)));
    try {
      const saved = await updatePiece(piece.id, changes);
      if (!saved) setPieces((c) => c.map((p) => (p.id === piece.id ? piece : p)));
    } catch {
      setPieces((c) => c.map((p) => (p.id === piece.id ? piece : p)));
    }
  }

  /**
   * Log a session, and put the piece on the desk if it was not already there —
   * practising something is how it becomes the thing you are working on.
   *
   * ponytail: last_practiced_at and session_count are all a button press
   * honestly knows. practice_seconds stays untouched until something measures
   * it; a page that insists every number is read from the file cannot start
   * inventing minutes.
   */
  async function practise(piece: Piece) {
    setPractisingId(piece.id);
    try {
      await patch(piece, {
        last_practiced_at: new Date().toISOString(),
        session_count: piece.session_count + 1,
        in_progress: true,
      });
      setLoggedId(piece.id);
      window.setTimeout(() => setLoggedId((id) => (id === piece.id ? null : id)), 1800);
    } finally {
      // Cleared on the way out, so a dropped connection cannot leave the
      // control disabled for the rest of the session.
      setPractisingId((id) => (id === piece.id ? null : id));
    }
  }

  function favourite(piece: Piece) {
    return patch(piece, { is_favourite: !piece.is_favourite });
  }

  async function remove(piece: Piece) {
    setPieces((c) => c.filter((p) => p.id !== piece.id));
    setOpenId(null);
    try {
      const removed = await deletePiece(piece.id);
      if (!removed) {
        setPieces((c) => [piece, ...c]);
        return;
      }
      // The row is the song; the .mid is what it was measured from. Dropping
      // one without the other leaves a file nothing points at.
      await removeMidi(removed.storage_path);
    } catch {
      setPieces((c) => [piece, ...c]);
    }
  }

  return (
    <>
      {open && (
        <SongSheet
          piece={open}
          onClose={() => setOpenId(null)}
          onPatch={(changes) => patch(open, changes)}
          onDelete={() => remove(open)}
          onPractise={() => practise(open)}
          practising={practisingId === open.id}
          logged={loggedId === open.id}
        />
      )}

      <div className="board flex h-screen flex-col overflow-hidden">
        <TopBar
          searchOpen={searchFocused}
          filterOpen={filterOpen}
          asideOpen={asideOpen}
          onCloseFilter={() => setFilterOpen(false)}
          filterPanel={filterPanel}
          onToggleSearch={() => {
            search.current?.focus();
            search.current?.select();
          }}
          onToggleFilter={() => setFilterOpen((value) => !value)}
          onToggleAside={() => setAsideOpen((value) => !value)}
          onAdd={() => {
            setSettingsOpen(false);
            document.getElementById(ADD_SONG_AT)?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenCatalogue={() => void openFolder("catalogue")}
          onOpenOutput={() => void openFolder("output")}
          onReload={() => window.location.reload()}
          onShortcuts={() => setShortcutsOpen(true)}
          onAbout={() => setSettingsOpen(true)}
        />

        {shortcutsOpen && <Shortcuts onClose={() => setShortcutsOpen(false)} />}

        <div className="relative flex-1 overflow-y-auto">
          <div className={PAGE_SHELL}>
          {/* --- the label glued across the cover --- */}
          <header className={HEADER_BAR}>
            <h1 className="font-book text-[19px] font-semibold tracking-[-0.01em] text-graphite">
              Songscription
            </h1>
            {/* Rendered away rather than `hidden`: the attribute sets display:none
                from the UA sheet, which any author `display` — here Tailwind's
                `flex` — silently wins against. It looked hidden in review and
                was not. */}
            {pieces.length > 0 && (
            <div className="relative flex w-full min-w-0 items-center sm:ml-auto sm:max-w-[26rem] sm:flex-1">
              <label htmlFor="song-search" className="sr-only">
                搜索曲目
              </label>
              <Search
                className="pointer-events-none absolute left-3 h-4 w-4 text-graphite-soft"
                strokeWidth={1.75}
              />
              <Input
                id="song-search"
                ref={search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="搜索曲目"
                aria-keyshortcuts="Control+F /"
                className="pl-9 pr-[4.5rem] transition-colors hover:border-graphite-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kraft-deep"
              />
              {query ? (
                <button
                  onClick={() => setQuery("")}
                  aria-label="清空搜索"
                  className="absolute right-3 rounded-[3px] text-graphite-soft transition-colors hover:text-kraft-deep"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-3 hidden rounded-[3px] border border-rule px-1.5 py-px text-[11.5px] font-medium text-graphite-soft sm:block">
                  Ctrl F
                </kbd>
              )}
            </div>
            )}
          </header>

          {pieces.length === 0 ? (
            <Empty onAdded={(p) => setPieces((c) => [p, ...c])} onOpen={setOpenId} />
          ) : (
            <>
              {current ? (
                <section className="mb-14">
                  {/* Sheets peeking out underneath when more than one piece is
                      on the desk, so the count is something you see rather than
                      something you read. */}
                  <div className="relative">
                    {onTheDesk.length > 2 && (
                      <div
                        aria-hidden
                        className="sheet absolute inset-x-6 -bottom-[15px] top-8 rounded-[3px]"
                      />
                    )}
                    {onTheDesk.length > 1 && (
                      <div
                        aria-hidden
                        className="sheet absolute inset-x-3 -bottom-[8px] top-4 rounded-[3px]"
                      />
                    )}
                  <article key={current.id} className="lay-down sheet sheet-raised relative">
                    <div className="flex flex-wrap items-end gap-x-8 gap-y-4 px-4 pb-4 pt-5 md:gap-y-5 md:px-8 md:pb-5 md:pt-6">
                      <div className="min-w-0 flex-1">
                        {/* The page at the top is whichever piece is still on
                            the desk, which for a file just added is one nobody
                            has played yet — so the label has to be true before
                            there is anything to return to. */}
                        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="text-[12.5px] font-semibold uppercase tracking-[0.11em] text-graphite-soft">
                            {current.last_practiced_at
                              ? "接着上次练"
                              : "正在起头的那一首"}
                            {onTheDesk.length > 1 && (
                              <span>
                                {"  ·  "}
                                {deskPos + 1} of {onTheDesk.length} on the desk
                              </span>
                            )}
                          </p>
                          {onTheDesk.length > 1 && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => flip(-1)}
                                aria-label="上一页谱子"
                                className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-rule text-graphite-soft transition-colors hover:bg-paper-warm hover:text-graphite active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-kraft-deep"
                              >
                                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                              </button>
                              <button
                                type="button"
                                onClick={() => flip(1)}
                                aria-label="桌上的下一页谱子"
                                className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-rule text-graphite-soft transition-colors hover:bg-paper-warm hover:text-graphite active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-kraft-deep"
                              >
                                <ChevronRight className="h-4 w-4" strokeWidth={2} />
                              </button>
                              <kbd className="ml-1 hidden rounded-[3px] border border-rule px-1.5 py-px text-[11px] font-medium text-graphite-soft sm:block">
                                ← →
                              </kbd>
                            </div>
                          )}
                        </div>
                        <h2 className="font-book text-[clamp(1.9rem,4.4vw,3rem)] font-medium leading-[1.06] tracking-[-0.022em] text-graphite">
                          {current.title}
                        </h2>
                        <p className="mt-2 text-[15px] text-graphite-soft">
                          {current.composer ?? "作曲者不详"}
                        </p>
                        <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-graphite">
                          <LevelMarks level={current.difficulty} />
                          <Summary piece={current} />
                        </p>
                      </div>
                      {/* Buttons here are whitespace-nowrap, so on a narrow
                          screen they overflow rather than shrink — the tertiary
                          one ran off the edge. Practise takes a line of its own
                          below md and the other three share the next. */}
                      {/* Two heights, not four. Practise leads at 60px; the two
                          that follow it both sit at 48, so the row reads as one
                          primary and two seconds rather than four loose objects.
                          The bookmark left entirely — see the card corner. */}
                      {/* Stacked rather than strung out in a line: the act the
                          catalogue exists for sits above the two that support
                          it, at nearly twice their height, so the hierarchy is
                          the first thing the eye gets rather than something it
                          has to work out from colour. */}
                      <div className="flex w-full flex-col items-stretch gap-2 md:w-[21rem]">
                        <PractiseButton
                          title={current.title}
                          onPractise={() => practise(current)}
                          busy={practisingId === current.id}
                          done={loggedId === current.id}
                          size="hero"
                          className="w-full"
                        />
                        {/* The bookmark ends this row rather than floating in
                            the card's corner, where it answered to nothing: same
                            height as its neighbours, same baseline, and the
                            column's right edge for free. */}
                        <div className="flex items-center gap-2">
                          <PlayButton
                            id={current.id}
                            source={midiSource(current)}
                            title={current.title}
                            className="min-w-0 flex-1"
                          />
                          <RevealButton
                            reveal="打开这一页"
                            compact
                            onClick={() => setOpenId(current.id)}
                            className="min-w-0 flex-1"
                          >
                            See how to start
                          </RevealButton>
                          <FavouriteButton
                            favourite={current.is_favourite}
                            title={current.title}
                            onToggle={() => favourite(current)}
                            className="h-11 w-11 shrink-0 border-rule bg-paper"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="squared border-y border-rule px-4 py-3.5 md:px-8 md:py-4">
                      <PitchMap
                        notes={current.pitch_map}
                        lowest={current.lowest_note}
                        highest={current.highest_note}
                        className="h-20 w-full md:h-24"
                        ariaLabel={`The shape of ${current.title}.`}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 md:px-8 md:py-2.5">
                      <p className="text-[13px] text-graphite-soft">
                        {lastPlayedLine(current.last_practiced_at)}
                      </p>
                        <Button
                          variant="quiet"
                          size="sm"
                          busy={finishing}
                          onClick={async () => {
                            setFinishing(true);
                            try {
                              await patch(current, { in_progress: false });
                            } finally {
                              setFinishing(false);
                            }
                          }}
                        >
                          Done with this
                        </Button>
                    </div>
                  </article>
                  </div>
                </section>
              ) : (
                <ClearDesk />
              )}

              {picks.length > 0 && (
                <Shelf
                  picks={picks}
                  onOpen={setOpenId}
                  onPractise={practise}
                  practisingId={practisingId}
                  loggedId={loggedId}
                />
              )}

              {/* --- the rest of the book --- */}
              <section>
                {/* ☰ 收起的是这一条：视图、收藏、难度、排序都是翻书时的家具，
                    收起来书还是那本书。 */}
                {asideOpen && (
                <div className={TOOLBAR_BAR}>
                  <h2 className="font-book text-[17px] font-medium text-graphite">
                    {shown.length === pieces.length
                      ? `Your songs · ${pieces.length}`
                      : `Your songs · ${shown.length} of ${pieces.length}`}
                  </h2>
                  <div className="flex w-full flex-wrap items-center gap-2.5 sm:ml-auto sm:w-auto sm:flex-nowrap">
                    <div
                      role="group"
                      aria-label="怎么看这些曲子"
                      className="flex shrink-0 overflow-hidden rounded-[5px] border border-rule bg-paper shadow-lift"
                    >
                      {(
                        [
                          { key: "grid", label: "Cards", Icon: LayoutGrid },
                          { key: "ribbon", label: "List", Icon: Rows3 },
                        ] as const
                      ).map(({ key, label, Icon }) => (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={view === key}
                          title={`Show your songs as ${label.toLowerCase()}`}
                          onClick={() => chooseView(key)}
                          className={`inline-flex h-10 items-center gap-2 px-3.5 text-[14px] font-semibold transition-colors active:translate-y-px ${
                            view === key
                              ? "bg-kraft text-graphite"
                              : "text-graphite-soft hover:bg-paper-warm hover:text-graphite"
                          }`}
                        >
                          <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
                          <span className="sr-only sm:not-sr-only">{label}</span>
                        </button>
                      ))}
                    </div>
                    {pieces.length >= NEEDS_NARROWING && (
                      <>
                    <Button
                      variant={onlyFavourites ? "default" : "paper"}
                      aria-pressed={onlyFavourites}
                      onClick={() => setOnlyFavourites((v) => !v)}
                      className="shrink-0"
                    >
                      <Star strokeWidth={1.75} fill={onlyFavourites ? "currentColor" : "none"} />
                      Favourites
                    </Button>
                    <Select
                      value={String(hardness)}
                      onValueChange={(v) => setHardness(v === "all" ? "all" : Number(v))}
                    >
                      <SelectTrigger
                        className="w-[calc(50%-0.3125rem)] sm:w-[11rem]"
                        aria-label="只看这个难度的曲子"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">不限难度</SelectItem>
                        {LEVELS.map((l) => (
                          <SelectItem key={l.level} value={String(l.level)}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
                      <SelectTrigger className="w-[calc(50%-0.3125rem)] sm:w-[13rem]" aria-label="排序方式">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SORTS.map((s) => (
                          <SelectItem key={s.key} value={s.key}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                      </>
                    )}
                  </div>
                </div>
                )}

                {shown.length === 0 ? (
                  <NoMatches
                    query={query}
                    hardness={hardness}
                    onClear={() => {
                      setQuery("");
                      setHardness("all");
                      setOnlyFavourites(false);
                    }}
                  />
                ) : view === "ribbon" ? (
                  <ul className="space-y-2">
                    {shown.slice(0, limit).map((piece, i) => (
                      <SongRow
                        key={piece.id}
                        piece={piece}
                        index={i}
                        onOpen={(p) => setOpenId(p.id)}
                        onFavourite={favourite}
                        onPractise={practise}
                        practising={practisingId === piece.id}
                        logged={loggedId === piece.id}
                      />
                    ))}
                  </ul>
                ) : (
                  <div className={CARD_GRID}>
                    {shown.slice(0, limit).map((piece, i) => (
                      <SongCard
                        key={piece.id}
                        piece={piece}
                        index={i}
                        onOpen={(p) => setOpenId(p.id)}
                        onFavourite={favourite}
                        onPractise={practise}
                        practising={practisingId === piece.id}
                        logged={loggedId === piece.id}
                      />
                    ))}
                  </div>
                )}

                {shown.length > limit && (
                  <div className="mt-6 flex flex-col items-center gap-2">
                    <Button variant="paper" onClick={() => setLimit((n) => n + PAGE)}>
                      Show {Math.min(PAGE, shown.length - limit)} more
                    </Button>
                    <p aria-live="polite" className="text-[13px] text-graphite-soft">
                      Showing {limit} of {shown.length}
                    </p>
                  </div>
                )}
              </section>

              <section id={ADD_SONG_AT} className="mt-16 max-w-[46rem] scroll-mt-8">
                <h2 className="kraft mb-5 inline-block rounded-[3px] px-3.5 py-1.5 font-book text-[17px] font-medium text-graphite shadow-lift">
                  Add a song
                </h2>
                <AddSong onAdded={(p) => setPieces((c) => [p, ...c])} onOpen={setOpenId} />
              </section>
            </>
          )}
        </div>

        {settingsOpen && (
          <Settings
            pieces={pieces}
            onClose={() => setSettingsOpen(false)}
            onRemoved={() => void reloadPieces()}
            onOpenPiece={(id) => {
              setSettingsOpen(false);
              setOpenId(id);
            }}
          />
        )}
        </div>
      </div>
    </>
  );
}

/** Where "add a song" lives, so the menu can scroll to it rather than pretend. */
const ADD_SONG_AT = "add-a-song";

/* -------------------------------------------------------------------------- */

/**
 * What stands where the piece in progress was.
 *
 * Marking the last song done used to leave the top of the page simply missing —
 * the largest thing on it gone, and nothing saying why or what to do instead.
 * An empty desk is a state worth drawing, not a gap.
 */
function ClearDesk() {
  return (
    <section className="mb-14">
      <div className="lay-down sheet sheet-raised px-4 py-9 text-center md:px-8 md:py-11">
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.11em] text-graphite-soft">
          Nothing on the desk
        </p>
        <h2 className="mx-auto mt-2 max-w-[20ch] font-book text-[clamp(1.7rem,4vw,2.5rem)] font-medium leading-[1.08] tracking-[-0.022em] text-graphite">
          Choose a song to practise
        </h2>
        <p className="mx-auto mt-3 max-w-[54ch] font-book text-[16px] leading-[1.6] text-graphite-soft">
          Open any song and press <span className="text-graphite">练这一首</span>. It will sit
          up here, with its shape and where to start, until you are done with it.
        </p>
      </div>
    </section>
  );
}

/**
 * For the evening you open the book with no plan.
 *
 * Not a recommendation engine — three questions the catalogue can already
 * answer about itself, each one showing the fact that chose it. A suggestion
 * you cannot interrogate is one you have to take on trust, and nothing else on
 * this page asks you to do that.
 */
function Shelf({
  picks,
  onOpen,
  onPractise,
  practisingId,
  loggedId,
}: {
  picks: Suggestion[];
  onOpen: (id: string) => void;
  onPractise: (piece: Piece) => void;
  practisingId: string | null;
  loggedId: string | null;
}) {
  return (
    <section className="mb-14">
      <h2 className="kraft mb-4 inline-block rounded-[3px] px-3.5 py-1.5 font-book text-[17px] font-medium text-graphite shadow-lift">
        Not sure what to play?
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {picks.map(({ piece, label, reason }, i) => (
          <li
            key={piece.id}
            className="lay-down sheet flex flex-col transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:shadow-lift-2"
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <button
              onClick={() => onOpen(piece.id)}
              className="block w-full cursor-pointer rounded-[3px] px-4 pb-2 pt-3.5 text-left focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-kraft-deep"
            >
              <span className="block text-[12.5px] font-semibold uppercase tracking-[0.11em] text-kraft-deep">
                {label}
              </span>
              <span className="mt-1.5 block font-book text-[19px] font-medium leading-[1.2] tracking-[-0.011em] text-graphite">
                {piece.title}
              </span>
              <span className="mt-0.5 block truncate text-[13.5px] text-graphite-soft">
                {piece.composer ?? "作曲者不详"}
              </span>
              {/* Two lines' worth whether the reason fills them or not, so the
                  three note strips below sit on one line across the row. */}
              <span className="mt-2 block min-h-[3.1em] font-book text-[15px] leading-[1.55] text-graphite-soft">
                {reason}
              </span>
            </button>

            <div className="squared mx-4 mt-2.5 rounded-[2px] border border-rule px-2 py-1.5">
              <PitchMap
                notes={piece.pitch_map}
                lowest={piece.lowest_note}
                highest={piece.highest_note}
                className="h-10 w-full"
                opening
                ariaLabel=""
              />
            </div>

            <div className="mt-auto flex items-center gap-2 px-4 pb-4 pt-3">
              <PractiseButton
                title={piece.title}
                onPractise={() => onPractise(piece)}
                busy={practisingId === piece.id}
                done={loggedId === piece.id}
              />
              <PlayButton id={piece.id} source={midiSource(piece)} title={piece.title} iconOnly />
              <span className="ml-auto flex items-center gap-2 text-[13px] text-graphite-soft">
                <LevelMarks level={piece.difficulty} />
                {level(piece.difficulty).name}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Empty({
  onAdded,
  onOpen,
}: {
  onAdded: (piece: Piece) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="py-4">
      <h2 className="max-w-[18ch] font-book text-[clamp(1.9rem,4.4vw,2.9rem)] font-medium leading-[1.1] tracking-[-0.022em] text-paper">
        The book is empty
      </h2>
      <p className="mt-3 max-w-[62ch] font-book text-[17px] leading-[1.65] text-rule">
        Every song you have transcribed lands here. Drop a MIDI file in and it gets read straight
        away: how long it takes, how hard it is, which keys it uses, and where to start.
      </p>
      <div className="mt-8">
        <AddSong onAdded={onAdded} onOpen={onOpen} />
      </div>
    </div>
  );
}

function NoMatches({
  query,
  hardness,
  onClear,
}: {
  query: string;
  hardness: number | "all";
  onClear: () => void;
}) {
  return (
    <div className="sheet px-6 py-9">
      <p className="font-book text-[19px] font-medium text-graphite">没有对得上的</p>
      <p className="mt-2 max-w-[58ch] font-book text-[15px] leading-[1.6] text-graphite-soft">
        {query && hardness !== "all"
          ? `No song called “${query}” is rated ${level(hardness).name.toLowerCase()}. It might be at a different difficulty.`
          : query
            ? `Nothing in your songs is called “${query}”.`
            : `You have nothing rated ${level(hardness as number).name.toLowerCase()} yet.`}
      </p>
      <Button variant="paper" className="mt-5" onClick={onClear}>
        Clear the filters
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** 筛选面板里的一枚档位：选中就上鎏金，跟工具栏里那套按钮一个脾气。 */
function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick(): void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-[3px] border px-2 py-[3px] font-label text-[12px] transition-colors ${
        active
          ? "border-kraft-deep bg-kraft text-graphite"
          : "border-rule bg-paper text-graphite-soft hover:bg-paper-warm hover:text-graphite"
      }`}
    >
      {label}
    </button>
  );
}

const comparators: Record<Sort, (a: Piece, b: Piece) => number> = {
  recent: (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  // The one you were on yesterday, which is the usual reason for coming back.
  "recently-played": (a, b) => played(b) - played(a),
  "longest-untouched": (a, b) => when(a) - when(b),
  shortest: (a, b) => a.duration_seconds - b.duration_seconds,
  easiest: (a, b) => a.difficulty - b.difficulty || a.duration_seconds - b.duration_seconds,
  az: (a, b) => a.title.localeCompare(b.title),
};

/** Never played sorts as longest-untouched, using when it was added. */
function when(piece: Piece): number {
  return +new Date(piece.last_practiced_at ?? piece.created_at);
}

/** Zero, not -Infinity: two never-played songs have to compare equal, not NaN. */
function played(piece: Piece): number {
  return piece.last_practiced_at ? Date.parse(piece.last_practiced_at) : 0;
}
