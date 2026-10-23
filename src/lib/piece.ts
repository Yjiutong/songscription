import type { DifficultyFactor } from "./midi";

/** One row of `pieces`. Column names match the SQL in `db/schema.sql`. */
export type Piece = {
  id: string;
  created_at: string;
  title: string;
  composer: string | null;
  source_filename: string;
  storage_path: string;
  file_size_bytes: number;
  checksum: string;
  duration_seconds: number;
  tempo_bpm: number | null;
  time_signature: string | null;
  key_signature: string | null;
  key_is_estimated: boolean;
  note_count: number;
  lowest_note: number;
  highest_note: number;
  distinct_pitch_count: number;
  max_simultaneous_notes: number;
  notes_per_second: number;
  black_key_fraction: number;
  track_count: number;
  two_hands: boolean;
  two_hands_basis: string;
  difficulty: number;
  difficulty_factors: DifficultyFactor[];
  /** [start, pitch, length, hand?] — hand 0 left, 1 right; absent on older rows. */
  pitch_map: [number, number, number, number?][];
  /** The user's own words about the piece. Nothing measures this. */
  notes: string | null;
  in_progress: boolean;
  is_favourite: boolean;
  last_practiced_at: string | null;
  practice_seconds: number;
  session_count: number;
};

/* -------------------------------------------------------------------------- *
 * Translate, don't transcribe.
 *
 * Every musical fact this app shows is paired with what it actually means for
 * someone who may never have read a note. A number on its own is a fact a
 * beginner has to already understand; a number plus its meaning is a thing they
 * can use tonight.
 * -------------------------------------------------------------------------- */

/**
 * How hard, in a word somebody would actually say. No codes, no invented
 * taxonomy — the previous build made people learn "ZONE A-03" before they could
 * read their own library, and that was the whole problem with it.
 */
export const LEVELS = [
  { level: 1, name: "容易", blurb: "一只手就够，音符挨得近，没有快的地方。" },
  { level: 2, name: "比较简单", blurb: "两只手都要用，但基本各自待着不动。" },
  { level: 3, name: "有点绕", blurb: "两只手都会移动，而且都不闲着。" },
  { level: 4, name: "难", blurb: "又快又宽又忙。要有放慢下来练的打算。" },
  { level: 5, name: "很难", blurb: "音符极多，跨度又大，速度还快。" },
] as const;

export function level(value: number) {
  return LEVELS[Math.min(5, Math.max(1, Math.round(value))) - 1];
}

/**
 * The one line every song leads with, the way a recipe leads with
 * "serves 4 · 25 minutes · easy".
 */
export function summaryLine(piece: Piece): string {
  return summaryParts(piece).join("  ·  ");
}

/**
 * The same summary split at its separators, so a narrow card can break between
 * facts but never inside one — "Both / hands" is not a phrase.
 */
export function summaryParts(piece: Piece): string[] {
  // Difficulty first: it is the question a learner actually filters on.
  // "Both hands" used to sit here and was true of every song in the library —
  // a fact that never varies earns no space. The note picture shows it instead.
  return [level(piece.difficulty).name, durationRough(piece.duration_seconds)];
}

/**
 * Three plain steps, written from what the file actually measures. This is the
 * part that makes the card a recipe rather than a label: it tells you what to
 * do, not only what the piece is.
 */
export function howToStart(piece: Piece): string[] {
  const steps: string[] = [];
  const factor = (key: string) => piece.difficulty_factors.find((f) => f.key === key)?.weight ?? 0;

  const independence = factor("independence");
  if (!piece.two_hands) {
    steps.push("整首都在一只手的范围内，可以直接上手弹，不必先分手。");
  } else if (independence > 0.5) {
    steps.push("两只手从头忙到尾，先把它们彻底分开学会，再往一起合。花时间的就是这一段。");
  } else if (independence > 0.22) {
    steps.push("左手在这里是真的在干活，不只是托着和弦。先单独弹几遍，弹到不用看也能走。");
  } else {
    steps.push("左手多半在托和弦，旋律在右手，所以先学会右手，再把左手垫到下面。");
  }

  if (piece.tempo_bpm && factor("speed") > 0.35) {
    steps.push(
      `慢一点起头，先按每分钟 ${Math.round(piece.tempo_bpm / 2)} 拍，而不是 ${piece.tempo_bpm} 拍。等到不再弹错再往上提速。`,
    );
  } else if (piece.tempo_bpm) {
    steps.push(
      `每分钟 ${piece.tempo_bpm} 拍，这个速度算是${tempoInWords(piece.tempo_bpm)}，所以练的时候可以接近原速。`,
    );
  }

  if (factor("reach") > 0.45) {
    steps.push(
      `两只手要跨过${reachInWords(piece.lowest_note, piece.highest_note)}。先找出必须跳的地方，把这几个动作单独练熟，再整首弹下来。`,
    );
  } else if (piece.black_key_fraction > 0.2) {
    steps.push(
      `每 100 个音符里约有 ${Math.round(piece.black_key_fraction * 100)} 个落在黑键上。手指会常常待在黑键之间，先慢到摸得准位置，再加快。`,
    );
  } else if (piece.max_simultaneous_notes >= 3) {
    steps.push("里面有和弦。先把每个和弦的手型找出来、单独按几遍，再合着拍子弹。");
  } else {
    steps.push("与其死磕某一个小节，不如从头到尾慢慢过一遍。它短到可以整首记在脑子里。");
  }

  return steps.slice(0, 3);
}

/**
 * Which file to open for a piece: the name it is stored under, inside the
 * catalogue folder. Playback reads it, the roll draws from it, and the "show me
 * the file" control reveals it — one source, three uses.
 */
export function midiSource(piece: Piece): string {
  return piece.storage_path;
}

/**
 * How long, roughly. On a card a learner wants "about two minutes", not
 * "1 minute 51 seconds" — the exact figure is in the full card.
 */
export function durationRough(seconds: number): string {
  if (seconds < 50) return "不到一分钟";
  if (seconds < 80) return "约一分钟";
  if (seconds < 110) return "约一分半";
  return `约 ${Math.round(seconds / 60)} 分钟`;
}

/** "3:04" */
export function duration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** 读屏与详情用的完整说法。 */
export function durationInWords(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins === 0) return `${secs} 秒`;
  return secs === 0 ? `${mins} 分钟` : `${mins} 分 ${secs} 秒`;
}

export function tempoInWords(bpm: number | null): string {
  if (bpm === null) return "没有写在文件里";
  if (bpm <= 55) return "极慢";
  if (bpm <= 72) return "比走路还慢";
  if (bpm <= 100) return "跟走路差不多";
  if (bpm <= 132) return "稍快";
  if (bpm <= 168) return "快";
  return "很快";
}

export function timeSignatureInWords(sig: string | null): string {
  if (!sig) return "没有写在文件里";
  switch (sig) {
    case "4/4":
      return "一小节四拍，最常见的拍子";
    case "3/4":
      return "一小节三拍，圆舞曲的拍子";
    case "2/4":
      return "一小节两拍，进行曲的拍子";
    case "6/8":
      return "两大拍，每拍里含三个音，摇曳着走";
    case "2/2":
      return "一小节两拍，拍子放得很慢";
    case "12/8":
      return "四大拍，每拍里含三个音";
    default:
      return `一小节 ${sig.split("/")[0]} 拍`;
  }
}

const SHARP_ORDER = ["F♯", "C♯", "G♯", "D♯", "A♯", "E♯"];
const FLAT_ORDER = ["B♭", "E♭", "A♭", "D♭", "G♭", "C♭"];

const SHARPS_IN_KEY: Record<string, number> = {
  "C major": 0, "G major": 1, "D major": 2, "A major": 3, "E major": 4, "B major": 5, "F♯ major": 6,
  "A minor": 0, "E minor": 1, "B minor": 2, "F♯ minor": 3, "C♯ minor": 4, "G♯ minor": 5, "D♯ minor": 6,
};

const FLATS_IN_KEY: Record<string, number> = {
  "F major": 1, "B♭ major": 2, "E♭ major": 3, "A♭ major": 4, "D♭ major": 5, "G♭ major": 6,
  "D minor": 1, "G minor": 2, "C minor": 3, "F minor": 4, "B♭ minor": 5, "E♭ minor": 6,
};

/** Tone.js writes "Bb"/"F#"; the interface writes "B♭"/"F♯". */
export function normaliseKey(key: string | null): string | null {
  if (!key) return null;
  return key
    .replace(/b\b/g, "♭")
    .replace(/#/g, "♯")
    .replace(/\bmajor\b/i, "major")
    .replace(/\bminor\b/i, "minor")
    .trim();
}

/**
 * The whole point of this function: "E♭ major" means nothing to a beginner, but
 * "three black keys to remember" is something they can act on.
 */
export function keyInWords(key: string | null): string {
  const normalised = normaliseKey(key);
  if (!normalised) return "没有写在文件里";

  const sharps = SHARPS_IN_KEY[normalised];
  const flats = FLATS_IN_KEY[normalised];

  if (sharps === 0) return "没有升降号，每一个音都在白键上";
  if (sharps !== undefined) {
    return `${count(sharps)}个升号（${SHARP_ORDER.slice(0, sharps).join("、")}），也就是要记住${count(sharps)}个黑键`;
  }
  if (flats !== undefined) {
    return `${count(flats)}个降号（${FLAT_ORDER.slice(0, flats).join("、")}），也就是要记住${count(flats)}个黑键`;
  }
  return "一个不常见的调，估计会有几个黑键";
}

function count(n: number): string {
  return ["", "1", "2", "3", "4", "5", "6"][n] ?? String(n);
}

export function rangeInWords(lowest: number, highest: number): string {
  const keys = highest - lowest + 1;
  const below = lowest < 55;
  const above = highest > 67;
  const reach =
    keys < 15
      ? "键盘上很小的一块，手几乎不用挪"
      : keys < 26
        ? "一个舒服的跨度，两手基本待在起手的位置"
        : keys < 40
          ? "跨度很宽，手要走一段路"
          : "几乎整个键盘，手要来回跑很远";
  const around =
    below && above
      ? "它同时够到中央 C 以下和以上很大的一段。"
      : above
        ? "整体都在中央 C 以上。"
        : below
          ? "整体都在中央 C 以下。"
          : "";
  return `88 个键里用到 ${keys} 个，${reach}。${around}`;
}

/** “三分之一个键盘”这样的说法——绝不说“三个八度”。 */
export function reachInWords(lowest: number, highest: number): string {
  const share = (highest - lowest + 1) / 88;
  if (share < 0.18) return "键盘的一小块";
  if (share < 0.28) return "大约四分之一个键盘";
  if (share < 0.38) return "大约三分之一个键盘";
  if (share < 0.55) return "接近半个键盘";
  if (share < 0.72) return "超过大半个键盘";
  return "几乎整个键盘";
}

/** “昨天”“3 天前”“还没练过” */
export function lastPractised(iso: string | null): string {
  if (!iso) return "还没练过";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;
  if (days < 14) return "上周";
  if (days < 61) return `${Math.floor(days / 7)} 周前`;
  return `${Math.floor(days / 30)} 个月前`;
}

export function practiceTime(seconds: number): string {
  if (seconds < 60) return "不到一分钟";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} 分钟`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分`;
}

/* -------------------------------------------------------------------------- *
 * Three ways in, for the days you open the book without a plan.
 *
 * Every pick is a row the catalogue already has, and every reason is the fact
 * that chose it — same rule as the difficulty score. Nothing is recommended
 * here that cannot say, in one line, why it is being recommended.
 * -------------------------------------------------------------------------- */

export type Suggestion = { piece: Piece; label: string; reason: string };

export function suggestions(pieces: Piece[], skip?: string | null): Suggestion[] {
  // Anything already on the desk is excluded, not just the one sheet on top.
  // Once the desk could hold several, the shelf started offering back songs the
  // reader had explicitly put there — "left the longest" pointing at a piece
  // sitting two inches above it.
  const pool = pieces.filter((p) => !p.in_progress && p.id !== skip);
  const taken = new Set<string>();
  const out: Suggestion[] = [];

  const pick = (label: string, reason: (p: Piece) => string, ranked: Piece[]) => {
    if (out.length >= 3) return;
    const piece = ranked.find((p) => !taken.has(p.id));
    if (!piece) return;
    taken.add(piece.id);
    out.push({ piece, label, reason: reason(piece) });
  };

  // Longest since you played it. The one thing a library is worst at is
  // reminding you of what you have stopped noticing.
  pick(
    "搁得最久的一首",
    (p) => `上一次练它是${lastPractised(p.last_practiced_at)}。`,
    pool
      .filter((p) => p.last_practiced_at)
      .sort((a, b) => Date.parse(a.last_practiced_at!) - Date.parse(b.last_practiced_at!)),
  );

  // Added and never opened — a different kind of neglect, so it gets its own slot.
  pick(
    "还没起头的一首",
    () => "加进册子之后，一个音都还没弹过。",
    pool
      .filter((p) => !p.last_practiced_at)
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)),
  );

  // For the evening where the honest amount of time available is ten minutes.
  pick(
    "只有几分钟的话",
    (p) => `${durationRough(p.duration_seconds)}，而且${level(p.difficulty).name}——一次就能弹完一首。`,
    [...pool].sort(
      (a, b) => a.duration_seconds - b.duration_seconds || a.difficulty - b.difficulty,
    ),
  );

  /* ---- reserves ----------------------------------------------------------
   * The three above each need a particular kind of song to exist. Once every
   * piece has been played, "never started" has nothing to offer and the shelf
   * came up two — a section that promises three and delivers two reads as a
   * bug, not a shortage. These fill from a different angle, and `pick` stops
   * at three, so they only ever appear when an earlier slot came up empty.
   * ---------------------------------------------------------------------- */

  // Your own words, handed back to you. Nothing else in the app knows this.
  pick(
    "这首你留过一句话",
    (p) => `你写的是：“${clip(p.notes ?? "", 96)}”`,
    pool
      .filter((p) => p.notes?.trim())
      .sort((a, b) => played(a) - played(b)),
  );

  // Marked as worth keeping, and then not played for a while.
  pick(
    "你标过星的一首",
    (p) => `这一首你标了记号，上一次练它是${lastPractised(p.last_practiced_at)}。`,
    pool.filter((p) => p.is_favourite).sort((a, b) => played(a) - played(b)),
  );

  // The gentlest thing in the book, for a day with nothing in the tank.
  pick(
    "册子里最容易的一首",
    (p) => `${level(p.difficulty).name}，${durationRough(p.duration_seconds)}。`,
    [...pool].sort(
      (a, b) => a.difficulty - b.difficulty || a.duration_seconds - b.duration_seconds,
    ),
  );

  return out;
}

/** Oldest practice date first; never-played sorts oldest of all. */
function played(piece: Piece): number {
  return piece.last_practiced_at ? Date.parse(piece.last_practiced_at) : 0;
}

/** Their sentence, cut at a word boundary rather than mid-syllable. */
function clip(text: string, max: number): string {
  const tidy = text.replace(/\s+/g, " ").trim();
  if (tidy.length <= max) return tidy;
  const cut = tidy.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,.;:—-]$/, "") + "…";
}

/* -------------------------------------------------------------------------- *
 * Finding one song again.
 *
 * The catalogue writes "Für Elise" and "Gymnopédie" because those are the
 * titles. Nobody types them that way — they type "fur elise", which is also
 * what the filename said. Matching the accents literally meant the one piece
 * everybody tries first could not be found at all.
 * -------------------------------------------------------------------------- */

/** "Für" → "fur". Decompose, drop the marks, lowercase. */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Every word you typed has to appear somewhere in the piece, in any order and
 * across any of its names — so "bach minuet" finds the minuet, and the
 * filename you downloaded still works as a search term months later.
 */
export function matches(piece: Piece, query: string): boolean {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const haystack = fold(
    [piece.title, piece.composer ?? "", piece.source_filename.replace(/[-_.]+/g, " ")].join(" "),
  );
  return terms.every((term) => haystack.includes(term));
}

/**
 * "Last played 3 days ago", or "Not played yet" — never "Last played not yet",
 * which is what pasting lastPractised() into a sentence produced on the one
 * card the page leads with. Both callers route through here.
 */
export function lastPlayedLine(iso: string | null): string {
  return iso ? `上一次练习是${lastPractised(iso)}` : "还没练过";
}
