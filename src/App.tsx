import { useEffect, useState } from "react";
import { Library } from "@/components/Library";
import { LibrarySkeleton } from "@/components/Skeletons";
import { listPieces } from "@/lib/db";
import type { Piece } from "@/lib/piece";
import { ensureSeeded } from "@/lib/seed";

/**
 * The window.
 *
 * This replaces the server component that used to fetch the library before any
 * HTML was sent. There is no HTML route any more — the app opens, the database
 * opens, and the first run measures the bundled shelf into it. Until that has
 * finished the reader sees the real page unwritten, at the real measurements,
 * so nothing jumps when the songs arrive.
 */
type Booted = { pieces: Piece[] };

let booting: Promise<Booted> | null = null;

/**
 * One boot per process. React re-runs effects on a hot edit, and a second pass
 * through the seed analyser would be nine MIDI files of wasted work.
 */
function boot(): Promise<Booted> {
  if (!booting) {
    booting = (async () => {
      await ensureSeeded();
      return { pieces: await listPieces() };
    })().catch((error) => {
      booting = null;
      throw error;
    });
  }
  return booting;
}

export function App() {
  const [pieces, setPieces] = useState<Piece[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void boot().then(
      (booted) => live && setPieces(booted.pieces),
      (error: unknown) => live && setFailure(explain(error)),
    );
    return () => {
      live = false;
    };
  }, []);

  if (failure) return <BootFailure detail={failure} />;
  if (!pieces) return <LibrarySkeleton />;
  return <Library initial={pieces} />;
}

/** A desktop app that cannot open its database has one thing to tell you. */
function explain(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "The catalogue could not be opened.";
}

function BootFailure({ detail }: { detail: string }) {
  return (
    <div className="board flex min-h-screen items-center justify-center px-6">
      <div className="sheet sheet-raised lay-down max-w-md px-7 py-8">
        <h1 className="font-book text-[22px] leading-tight text-graphite">
          曲目册打不开
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-graphite-soft">
          什么都没有丢——数据库和你的曲子都还在原来的地方。这是机器给出的原话：
        </p>
        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-[2px] border border-rule bg-sheet px-3 py-2 font-label text-[11.5px] leading-relaxed text-graphite">
          {detail}
        </pre>
        <p className="mt-4 text-[12.5px] leading-relaxed text-graphite-soft">
          关掉窗口再打开一次。如果还是这句话，那就是存放曲目册的文件夹被移走了，
          或者它现在只读。
        </p>
      </div>
    </div>
  );
}
