// Songscription — the desktop shell.
//
// This file is the whole of the app's presence in Rust: open the window, open
// the database, and answer nine calls from the interface. There is no music in
// here. The MIDI analysis, the difficulty score, the synthesiser and the SQL
// all live in TypeScript under src/, so the interesting code exists once and
// stays in one language.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod storage;

use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;
use serde_json::Value;
use tauri::{Manager, State};

struct App {
    conn: Mutex<Connection>,
    /// `<app data>/data/midi` — the .mid files live beside the database so a
    /// backup is one folder, not two places that can drift apart.
    midi_dir: PathBuf,
}

impl App {
    fn conn(&self) -> Result<MutexGuard<'_, Connection>, String> {
        self.conn
            .lock()
            .map_err(|_| "the database handle was poisoned by a panic".to_string())
    }
}

// --- SQLite ----------------------------------------------------------------

// The guard is bound to a name before the call, not written as `&app.conn()?`:
// the `?` and the `&` in one expression make the compiler check the guard
// itself against `&Connection` instead of deref-coercing it, which does not
// unify. Naming it also shows exactly how long the lock is held.

#[tauri::command]
fn db_run(app: State<'_, App>, sql: String, params: Vec<Value>) -> Result<usize, String> {
    let conn = app.conn()?;
    db::run(&conn, &sql, params)
}

#[tauri::command]
fn db_all(app: State<'_, App>, sql: String, params: Vec<Value>) -> Result<Vec<Value>, String> {
    let conn = app.conn()?;
    db::all(&conn, &sql, params)
}

#[tauri::command]
fn db_exec(app: State<'_, App>, sql: String) -> Result<(), String> {
    let conn = app.conn()?;
    db::exec(&conn, &sql)
}

// --- the .mid files --------------------------------------------------------

#[tauri::command]
fn midi_write(app: State<'_, App>, name: String, data: String) -> Result<(), String> {
    let bytes = storage::decode(&data)?;
    storage::write(&app.midi_dir, &name, &bytes)
}

#[tauri::command]
fn midi_read(app: State<'_, App>, name: String) -> Result<String, String> {
    Ok(storage::encode(&storage::read(&app.midi_dir, &name)?))
}

#[tauri::command]
fn midi_remove(app: State<'_, App>, name: String) -> Result<(), String> {
    storage::remove(&app.midi_dir, &name)
}

#[tauri::command]
fn midi_exists(app: State<'_, App>, name: String) -> Result<bool, String> {
    storage::exists(&app.midi_dir, &name)
}

#[tauri::command]
fn midi_reveal(app: State<'_, App>, name: String) -> Result<(), String> {
    storage::reveal(&app.midi_dir, &name)
}

/// Where everything is kept, so the About line can tell the truth instead of
/// saying "somewhere in your app data".
#[tauri::command]
fn catalogue_dir(app: State<'_, App>) -> Result<String, String> {
    let root = app.midi_dir.parent().unwrap_or(&app.midi_dir);
    Ok(root.display().to_string())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let root = app.path().app_data_dir()?.join("data");
            let midi_dir = root.join("midi");
            std::fs::create_dir_all(&midi_dir)?;

            let conn = db::open(&root.join("catalogue.db"))?;
            app.manage(App {
                conn: Mutex::new(conn),
                midi_dir,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db_run,
            db_all,
            db_exec,
            midi_write,
            midi_read,
            midi_remove,
            midi_exists,
            midi_reveal,
            catalogue_dir
        ])
        .run(tauri::generate_context!())
        .expect("the Songscription window could not start");
}
