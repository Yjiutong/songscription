"use client";

import { StickyNote } from "lucide-react";
import { PitchMap } from "./PitchMap";
import { FavouriteButton, LevelMarks, PlayButton, PractiseButton } from "./kit";
import {
  durationRough,
  midiSource,
  lastPractised,
  level,
  summaryLine,
  summaryParts,
  type Piece,
} from "@/lib/piece";

/**
 * What opening a card gets you, said on the card.
 *
 * The lift on hover says "this does something" but not what, and the PLAY
 * button beside it is a different act, so without a word the two are easy to
 * confuse. One place, because the same word has to reach the screen reader.
 */
const OPEN_LABEL = "Preview";

/** Breaks only at the separators, never inside a phrase. */
export function Summary({ piece }: { piece: Piece }) {
  return (
    <>
      {summaryParts(piece).map((part, i) => (
        <span key={part} className="whitespace-nowrap">
          {i > 0 && <span aria-hidden>{"  ·  "}</span>}
          {part}
        </span>
      ))}
    </>
  );
}

/**
 * One song, as a page in the book.
 *
 * The music is pencilled onto the squares at the top, because it is the only
 * thing here that differs for every piece and is worth looking at. The words
 * under it caption the drawing, and the bookmark in the corner is how a page
 * becomes one of yours.
 */
export function SongCard({
  piece,
  onOpen,
  onFavourite,
  onPractise,
  practising = false,
  logged = false,
  index = 0,
}: {
  piece: Piece;
  onOpen: (piece: Piece) => void;
  onFavourite: (piece: Piece) => void;
  onPractise: (piece: Piece) => void;
  practising?: boolean;
  logged?: boolean;
  index?: number;
}) {
  return (
    <article
      className="lay-down sheet group relative flex flex-col transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:shadow-lift-2 active:translate-y-0 active:shadow-lift active:duration-75"
      style={{ animationDelay: `${Math.min(index, 11) * 35}ms` }}
    >
      <button
        onClick={() => onOpen(piece)}
        className="block w-full cursor-pointer rounded-[3px] text-left focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-kraft-deep"
      >
        <span className="squared relative block rounded-t-[3px] border-b border-rule px-3.5 py-3.5 md:px-4 md:py-4">
          <PitchMap
            notes={piece.pitch_map}
            lowest={piece.lowest_note}
            highest={piece.highest_note}
            className="h-24 w-full transition-[filter] duration-200 [@media(hover:hover)]:group-hover:blur-[2.5px]"
            opening
            ariaLabel={`The shape of ${piece.title}. Right hand clay, left hand graphite.`}
          />
          {/* Only where there is a pointer to hover with: on a touch screen this
              would either never fire or stick on after a tap. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden items-center justify-center opacity-0 transition-opacity duration-200 [@media(hover:hover)]:flex [@media(hover:hover)]:group-hover:opacity-100"
          >
            {/* The ink blurs, the ruling it is drawn on does not — the page
                stays put and only the pencil goes soft behind the label. */}
            <span className="kraft rounded-[3px] px-3 py-1.5 font-label text-[11px] font-semibold uppercase tracking-[0.16em] text-graphite shadow-lift">
              {OPEN_LABEL}
            </span>
          </span>
        </span>

        <span className="block px-4 pb-3 pt-3.5">
          <span className="block font-book text-[19px] font-medium leading-[1.2] tracking-[-0.011em] text-graphite">
            {piece.title}
          </span>
          <span className="mt-0.5 block truncate text-[13.5px] text-graphite-soft">
            {piece.composer ?? "作曲者不详"}
          </span>
          {/* The hover label is the sighted half of this; nobody should have to
              own a mouse to be told what the card does. */}
          <span className="sr-only">{OPEN_LABEL}</span>
        </span>
      </button>

      {/* The bookmark sits over the page rather than inside the link, so saving
          a piece never means opening it first. */}
      <FavouriteButton
        favourite={piece.is_favourite}
        title={piece.title}
        onToggle={() => onFavourite(piece)}
        className="absolute right-2.5 top-2.5"
      />

      <div className="mt-auto px-4 pb-4 pt-1">
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-graphite-soft">
          <LevelMarks level={piece.difficulty} />
          <Summary piece={piece} />
        </p>
        <div className="mt-3 flex items-center gap-2">
          <PractiseButton
            title={piece.title}
            onPractise={() => onPractise(piece)}
            busy={practising}
            done={logged}
          />
          <PlayButton id={piece.id} source={midiSource(piece)} title={piece.title} iconOnly />
          <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-[13px] text-graphite-soft">
            {/* A note you left is a reason to come back to this one, so it is
                worth a mark on the card rather than only inside it. */}
            {piece.notes && (
              <StickyNote
                className="h-[14px] w-[14px] shrink-0 text-kraft-deep"
                strokeWidth={1.75}
                aria-label="这一首你留过一句话"
              />
            )}
            <span className="truncate">{lastPractised(piece.last_practiced_at)}</span>
          </span>
        </div>
      </div>
    </article>
  );
}

/**
 * The same song as a ribbon.
 *
 * One line per piece, the way a record library lists tracks: the drawing as its
 * artwork at the left, the name, then the facts in fixed columns so the eye can
 * run straight down them, and the two acts at the right. It is the same content
 * as the card with the reading order turned on its side, for when you know what
 * you are looking for rather than browsing.
 */
export function SongRow({
  piece,
  onOpen,
  onFavourite,
  onPractise,
  practising = false,
  logged = false,
  index = 0,
}: {
  piece: Piece;
  onOpen: (piece: Piece) => void;
  onFavourite: (piece: Piece) => void;
  onPractise: (piece: Piece) => void;
  practising?: boolean;
  logged?: boolean;
  index?: number;
}) {
  return (
    <li
      className="lay-down sheet group flex items-center gap-2 pr-2 transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:bg-paper-warm hover:shadow-lift-2 active:translate-y-0 active:shadow-lift active:duration-75 sm:gap-3 sm:pr-3"
      style={{ animationDelay: `${Math.min(index, 14) * 18}ms` }}
    >
      <button
        onClick={() => onOpen(piece)}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 rounded-[3px] py-2.5 pl-2.5 pr-2 text-left focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-kraft-deep md:gap-6"
      >
        <span className="squared hidden h-[52px] w-[92px] shrink-0 items-center overflow-hidden rounded-[2px] border border-rule px-1.5 sm:flex">
          <PitchMap
            notes={piece.pitch_map}
            lowest={piece.lowest_note}
            highest={piece.highest_note}
            className="h-9 w-full"
            opening
            ariaLabel=""
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-book text-[16px] font-medium text-graphite transition-colors group-hover:text-kraft-deep">
            {piece.title}
          </span>
          <span className="block truncate text-[13px] text-graphite-soft">
            {piece.composer ?? "作曲者不详"}
            {piece.in_progress && (
              <span className="ml-2 font-semibold uppercase tracking-[0.08em] text-kraft-deep">
                · Learning
              </span>
            )}
          </span>
        </span>

        <span className="hidden w-[9.5rem] shrink-0 items-center gap-2 text-[13px] text-graphite-soft lg:flex">
          <LevelMarks level={piece.difficulty} />
          {level(piece.difficulty).name}
        </span>
        <span className="hidden w-[6.5rem] shrink-0 text-right text-[13px] tabular-nums text-graphite-soft md:block">
          {durationRough(piece.duration_seconds)}
        </span>
        <span className="hidden w-[7rem] shrink-0 text-right text-[13px] text-graphite-soft md:block">
          {lastPractised(piece.last_practiced_at)}
        </span>
        <span className="sr-only">
          {level(piece.difficulty).name}, {summaryLine(piece)}
        </span>
      </button>

      <FavouriteButton
        favourite={piece.is_favourite}
        title={piece.title}
        onToggle={() => onFavourite(piece)}
      />
      <PlayButton
        id={piece.id}
        source={midiSource(piece)}
        title={piece.title}
        compact
        className="shrink-0"
      />
      <PractiseButton
        title={piece.title}
        onPractise={() => onPractise(piece)}
        busy={practising}
        done={logged}
        compact
        className="shrink-0"
      />
    </li>
  );
}
