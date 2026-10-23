"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CircleAlert, FilePlus2, Library as LibraryIcon, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addFile } from "@/lib/upload";
import type { Piece } from "@/lib/piece";

type Job = {
  id: number;
  file: File;
  stage: "working" | "done" | "failed";
  /** the piece this job produced, or the one it turned out to be a copy of */
  pieceId?: string;
  error?: string;
  detail?: string;
};

let jobId = 0;

export function AddSong({
  onAdded,
  onOpen,
}: {
  onAdded: (piece: Piece) => void;
  onOpen?: (id: string) => void;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // A finished row clears itself; if the section unmounts first, the timers go
  // with it rather than setting state on something that is no longer there.
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const update = useCallback(
    (id: number, changes: Partial<Job>) =>
      setJobs((c) => c.map((j) => (j.id === id ? { ...j, ...changes } : j))),
    [],
  );

  const run = useCallback(
    async (job: Job) => {
      update(job.id, { stage: "working", error: undefined, detail: undefined });
      const result = await addFile(job.file);

      if (!result.ok) {
        update(job.id, {
          stage: "failed",
          error: result.error,
          detail: result.detail,
          pieceId: result.duplicateOf,
        });
        return;
      }
      update(job.id, { stage: "done", pieceId: result.piece.id });
      onAdded(result.piece);
      // Long enough to read the line and click through to the piece, short
      // enough that the drop zone is clear again by the time you come back.
      timers.current.push(
        setTimeout(() => setJobs((c) => c.filter((j) => j.id !== job.id)), 6000),
      );
    },
    [onAdded, update],
  );

  const send = useCallback(
    async (files: File[]) => {
      const queued = files.map((file) => ({
        id: ++jobId,
        file,
        stage: "working" as const,
      }));
      // The whole batch is listed before any of it is sent, so dropping eight
      // files shows eight rows at once instead of one appearing at a time.
      setJobs((c) => [...c, ...queued]);
      // One at a time on purpose: the catalogue orders by arrival, and a file
      // dropped alongside its own duplicate has to lose to it, not race it.
      for (const job of queued) await run(job);
    },
    [run],
  );

  const working = jobs.some((j) => j.stage === "working");

  // Closing the tab mid-upload aborts a request the server is still reading,
  // so say so while one is in the air.
  useEffect(() => {
    if (!working) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [working]);

  return (
    <div>
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          depth.current++;
          setOver(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          depth.current--;
          if (depth.current <= 0) setOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          depth.current = 0;
          setOver(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length) void send(files);
        }}
        // A blank leaf at the back of the book, waiting to be written on: a
        // sheet like every other sheet, so dropping a file onto it is obviously
        // the same gesture as opening one.
        className={`squared rounded-[3px] px-6 py-7 text-center shadow-lift transition-[background-color,box-shadow,transform] duration-150 ${
          over ? "-translate-y-px bg-paper-warm shadow-lift-2" : ""
        }`}
      >
        <p className="font-book text-[21px] font-medium text-graphite">
          {over ? "松手即可加入" : "把 MIDI 文件拖到这里"}
        </p>
        <p className="mx-auto mt-2 max-w-[56ch] font-book text-[15px] leading-[1.65] text-graphite-soft">
          The file Songscription gives you when a transcription finishes. It gets read straight
          away, so you don&rsquo;t have to type anything.
        </p>
        <Button variant="paper" className="mt-5" onClick={() => input.current?.click()}>
          <FilePlus2 strokeWidth={1.75} />
          Choose a file
        </Button>
        <input
          ref={input}
          type="file"
          accept=".mid,.midi,audio/midi"
          multiple
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) void send(files);
            e.target.value = "";
          }}
        />
      </div>

      {jobs.length > 0 && (
        <ul aria-live="polite" className="mt-4 space-y-3">
          {jobs.map((job) => {
            const duplicate = job.stage === "failed" && Boolean(job.pieceId);
            return (
              <li key={job.id} className="sheet flex items-start gap-3 px-5 py-3.5">
                <span
                  className={`mt-0.5 shrink-0 ${
                    job.stage === "failed" && !duplicate ? "text-kraft-deep" : "text-graphite-soft"
                  }`}
                >
                  {job.stage === "done" ? (
                    <Check className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  ) : duplicate ? (
                    <LibraryIcon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  ) : job.stage === "failed" ? (
                    <CircleAlert className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  ) : (
                    <FilePlus2 className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-graphite">{job.file.name}</p>
                  {job.stage === "failed" ? (
                    <>
                      <p className="mt-0.5 font-book text-[15px] leading-[1.55] text-graphite">
                        {job.error}
                      </p>
                      {job.detail && (
                        <p className="mt-0.5 font-book text-[15px] leading-[1.55] text-graphite-soft">
                          {job.detail}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {duplicate && onOpen && (
                          <Button variant="paper" size="sm" onClick={() => onOpen(job.pieceId!)}>
                            Open the one you have
                          </Button>
                        )}
                        {/* The file is still in memory, so a failed upload is
                            one click from another go — no hunting for it again. */}
                        {!duplicate && (
                          <Button variant="paper" size="sm" onClick={() => void run(job)}>
                            <RotateCcw strokeWidth={1.75} />
                            Try again
                          </Button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="mt-0.5 text-[12.5px] text-graphite-soft">
                        {job.stage === "working" ? "Reading the music…" : "已加入曲目册"}
                      </p>
                      <div className="mt-2 h-[6px] w-full overflow-hidden rounded-full bg-rule">
                        {job.stage === "done" ? (
                          <div className="h-full w-full rounded-full bg-graphite-soft" />
                        ) : (
                          <div className="sweep h-full w-1/4 rounded-full bg-kraft-deep" />
                        )}
                      </div>
                      {job.stage === "done" && onOpen && job.pieceId && (
                        <Button
                          variant="paper"
                          size="sm"
                          className="mt-2.5"
                          onClick={() => onOpen(job.pieceId!)}
                        >
                          Open its page
                        </Button>
                      )}
                    </>
                  )}
                </div>
                {job.stage === "failed" && (
                  <button
                    onClick={() => setJobs((c) => c.filter((j) => j.id !== job.id))}
                    aria-label={`Dismiss the problem with ${job.file.name}`}
                    className="shrink-0 rounded-[3px] text-graphite-soft transition-colors hover:text-kraft-deep"
                  >
                    <X className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
