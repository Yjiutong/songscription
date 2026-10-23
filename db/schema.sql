-- Songscription catalogue — local schema (SQLite)
--
-- The app creates this automatically on first run (src/lib/db.ts). This file is
-- kept as the readable record of the data model: the three groups of columns are
-- deliberately kept apart, and the constraint that makes the design honest is
-- the application-level one — only the user's own layer is editable.
--
--   1. identity      — what the file is and where it lives
--   2. measured      — read out of the MIDI itself, never invented
--   3. the user's    — the layer the app writes as you practise
--
-- The .mid binaries live beside the database in data/midi/, named
-- "<checksum-prefix>-<source-filename>". storage_path holds that name.

create table if not exists pieces (
  id                      text primary key,
  created_at              text not null,

  -- 1. identity
  title                   text    not null,
  composer                text,
  source_filename         text    not null,
  storage_path            text    not null unique,
  file_size_bytes         integer not null check (file_size_bytes > 0),
  checksum                text    not null unique,

  -- 2. measured from the file
  duration_seconds        real    not null check (duration_seconds > 0),
  tempo_bpm               real,
  time_signature          text,
  key_signature           text,
  key_is_estimated        integer not null default 1,
  note_count              integer not null check (note_count > 0),
  lowest_note             integer not null check (lowest_note between 0 and 127),
  highest_note            integer not null check (highest_note between 0 and 127),
  distinct_pitch_count    integer not null,
  max_simultaneous_notes  integer not null,
  notes_per_second        real    not null,
  black_key_fraction      real    not null,
  track_count             integer not null,
  two_hands               integer not null,
  two_hands_basis         text    not null,
  difficulty              integer not null check (difficulty between 1 and 5),
  difficulty_factors      text    not null default '[]',
  pitch_map               text    not null default '[]',

  -- 3. the user's own layer
  notes                   text,
  in_progress             integer not null default 0,
  is_favourite            integer not null default 0,
  last_practiced_at       text,
  practice_seconds        integer not null default 0 check (practice_seconds >= 0),
  session_count           integer not null default 0 check (session_count >= 0),

  constraint pieces_range_ordered check (highest_note >= lowest_note)
);

-- The one query the app runs on startup: order by created_at desc.
create index if not exists pieces_created_at_idx on pieces (created_at desc);
