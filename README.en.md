# Songscription

*中文版：[README.md](./README.md)*

A catalogue for the songs you have had transcribed.

You give it a `.mid`; it reads the file and tells you, in a beginner's words, how long the piece is,
how hard it is, which keys it uses, how busy each hand is, and where to start. It plays the piece on
a piano it synthesises in the window — there are no audio files — and it keeps your bookmarks, notes,
sessions and everything else in a database on your own machine.

**It is a desktop application.** One window, no server, no browser tab, no account, nothing to
configure.

---

## What it is made of

Two layers, and the split is the point.

```
  src/                        the application
  ├── lib/midi.ts             analysis: measures the file, scores difficulty
  ├── lib/audio.ts            synthesis: additive piano, rolling scheduler
  ├── lib/db.ts               every SQL statement the catalogue runs
  ├── lib/notation.ts         quantising: MIDI notes into measures
  ├── lib/staff-render.ts     the staff: VexFlow onto SVG / Canvas
  ├── lib/staff-pages.ts      A4 pagination: measure, break, lay out a page
  ├── lib/zip.ts pdf.ts       packing with no dependencies: ZIP and PDF
  ├── lib/platform/           ── the seam ──────────────────────────
  │   ├── types.ts              what the app needs: sql + files
  │   ├── desktop.ts            invoke() → Rust
  │   └── web.ts                sql.js + IndexedDB (development only)
  ├── components/             the interface, in React and SVG
  │   ├── Roll.tsx               the piano roll
  │   └── Staff.tsx              the staff
  └── App.tsx                 opens the database, seeds it, renders

  src-tauri/                  the shell
  ├── src/db.rs               SQLite bridge (rusqlite)
  ├── src/storage.rs          .mid files on disk
  └── src/main.rs             the window, and nine commands
```

The interesting code lives in TypeScript. Rust owns a database handle, a handful of file operations and
a window. It does not know what a piece is, it does not own the schema, and it never sees a difficulty
score — so there is exactly one implementation of the hard part, in one language.

`src/lib/platform/types.ts` is the seam. Above it the application cannot tell whether it is running
in a webview on top of SQLite or in a browser tab on top of WebAssembly. Both adapters run the *same*
SQL from `src/lib/db.ts`, which is why a query that works in one cannot quietly disagree with the
other.

### Where things are kept

| | Desktop (`npm run desktop`) | Browser (`npm run dev`) |
|---|---|---|
| Database | SQLite file, `rusqlite` | SQLite file, `sql.js` (WASM) |
| Rows live in | the app data folder | IndexedDB in the browser profile |
| `.mid` files | a real folder you can open | blobs in IndexedDB |
| Survives a reinstall | yes, if you keep the folder | no |

The desktop app keeps everything in one folder, so a backup is one copy:

- **Windows** `%APPDATA%\com.songscription.catalogue\data\`
- **macOS** `~/Library/Application Support/com.songscription.catalogue/data/`
- **Linux** `~/.local/share/com.songscription.catalogue/data/`

It holds `catalogue.db` and `midi/`. Copy the folder to back up; put it back to restore.

The browser build exists so the interface can be opened and changed without a Rust toolchain. It is
not the product: its data sits inside a browser profile, easy to lose, which is why the app is not
shipped that way.

---

## Running it

### Requirements

- **Node 20+**
- **Rust** (`rustup`) with the platform's C toolchain — on Windows that is the *Desktop development
  with C++* workload from Visual Studio Build Tools. `rusqlite` is built with `bundled`, so SQLite is
  compiled in and nothing else has to be installed.
- **WebView2** — preinstalled on Windows 11 and current Windows 10; macOS and Linux use the system
  webview.

### Commands

```bash
npm install

npm run desktop        # the app, in a real window, with hot reload
npm run package        # builds both: the installer and the portable single exe

npm run dev            # the interface in a browser, no Rust needed (development only)
npm test               # 74 unit tests, including the SQL against a real SQLite
```

No environment variables, no keys, no service to start.

### Two exes, two occasions

`npm run package` compiles twice and leaves both in `release/`:

| File | How to use it | Where the songs live |
|---|---|---|
| `Songscription-0.1.0-x64-setup.exe` | Double-click to install. Chinese wizard, per-user, no admin rights | The system application-data directory |
| `Songscription-0.1.0-portable-x64.exe` | No installation; runs from wherever it sits | `Songscription Data\` beside the exe |

The portable build puts everything in one file: copy it to a USB stick, copy it to another Windows
machine with WebView2, and the catalogue goes with it. If it finds itself somewhere it cannot write —
Program Files, a write-protected stick — it falls back to the system directory rather than refusing to
start. To move it, move `Songscription Data` along with it; that folder is the whole of its world.

The two builds are feature for feature the same. The installer gets you a Start-menu entry and a clean
uninstall; the portable one leaves no trace, and deleting the folder is the uninstall.

### If the Rust build is not an option

`npm run dev` runs the same interface against `sql.js` in the browser. No toolchain, no network. What
it cannot give you is a double-click app or a folder you can back up.

---

## What it does

- **Measures, never guesses.** Duration, tempo, time signature, key, note count, range, polyphony,
  black-key share and per-hand density all come out of the file. A first run measures the nine
  bundled pieces the same way an upload does, so the shelf cannot contain a row the real flow could
  never produce.
- **Difficulty is a score with a receipt.** Five weighted factors, and the one that matters is the
  *busier* hand's speed against the lazier one's: what makes a piece hard is both hands working at
  once, not the biggest chord. The score is bucketed into 1–5 rather than averaged, because averaging
  put seven of twelve pieces in the same band and said nothing.
- **Playback is synthesised.** Six harmonics plus hammer noise and a generated convolution room, per
  note, scheduled in a rolling ~1.1 s window so a five-minute piece does not build fifty thousand
  nodes up front.
- **The drawing is the piece.** Cards, rows and the detail sheet all draw the piece's own notes, right
  hand in gold and left in graphite, on a 24px ruled lattice.
- **The staff can leave the screen and go back onto paper.** The quantised score is paginated onto A4
  portrait sheets — 14mm margins, the title and key signature on the first page, a small running title
  thereafter, page numbers at the foot, a gilt rule between header and staff. How many systems fit is
  measured rather than estimated, and breaks fall only between measures. It exports to PNG or JPG (one
  file a page, zipped when there are several) or to PDF (one booklet, a JPEG embedded per page).

- **The things in the window are yours to arrange.** A menu bar runs along the top (edit / window /
  help / about), and its colour follows the cover: a dark picture darkens it, a snowy one turns it
  pale, and the lettering follows. The settings page (Ctrl+, or from the menu) keeps four things:
  the cover picture, every piece in the book (open, favourite, delete), the export format and
  definition, and the output folder with the files already in it.
- **Uploads are checked once, then stored.** Extension, emptiness and a 2 MB ceiling; SHA-256 of the
  bytes for the duplicate check and for the file's name on disk.
- **Search folds accents.** "fur elise" finds "Für Elise", because that is what everyone types.
- **Your layer is editable; the measured layer is not.** The update path filters against a whitelist,
  so a stale caller cannot overwrite a number the app promised it read from the file.

---

## Tests

```bash
npm test
```

`src/lib/db.test.ts` is the one worth knowing about: it swaps the platform for a Node SQLite and runs
the *same* statements the desktop build runs. An insert that lists thirty-two columns in one order and
binds them in another looks fine in review and fails at runtime, so it is executed rather than read.

`scripts/smoke.mjs` drives a running build over the DevTools protocol — real time, real IndexedDB,
real audio graph:

```bash
npm run build && npx vite preview --port 4173 &
"…/msedge.exe" --headless=new --remote-debugging-port=9337 --user-data-dir=/tmp/s \
  --autoplay-policy=no-user-gesture-required http://localhost:4173/ &
WAIT_MS=8000 node scripts/smoke.mjs 9337 http://localhost:4173/
```

`--dump-dom` is not enough on its own: virtual time does not wait for IndexedDB, so a snapshot taken
that way is always one step early and always shows the skeleton.
