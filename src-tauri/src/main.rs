// Songscription — the desktop shell.
//
// This file is the whole of the app's presence in Rust: open the window, open
// the database, and answer nine calls from the interface. There is no music in
// here. The MIDI analysis, the difficulty score, the synthesiser and the SQL
// all live in TypeScript under src/, so the interesting code exists once and
// stays in one language.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod files;
mod storage;

use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;
use serde_json::Value;
use tauri::{Manager, State};

struct App {
    conn: Mutex<Connection>,
    /// `<app data>/data` — everything that belongs to this copy of the app.
    root: PathBuf,
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
    Ok(app.root.display().to_string())
}

// --- the things the interface keeps for itself -----------------------------
//
// Background image, exported sheets, a few preferences. None of it is music;
// all of it has to survive being copied to another machine, which is why it
// lives on disk next to the database rather than in localStorage.

#[tauri::command]
fn settings_all(app: State<'_, App>) -> Value {
    Value::Object(files::read_settings(&app.root))
}

#[tauri::command]
fn settings_set(app: State<'_, App>, key: String, value: Value) -> Result<(), String> {
    files::set_setting(&app.root, &key, value)
}

#[tauri::command]
fn background_read(app: State<'_, App>) -> Option<(String, String)> {
    files::background_read(&app.root)
}

#[tauri::command]
fn background_write(app: State<'_, App>, data: String, mime: String) -> Result<(), String> {
    files::background_write(&app.root, &data, &mime)
}

#[tauri::command]
fn background_clear(app: State<'_, App>) -> Result<(), String> {
    files::background_clear(&app.root)
}

#[tauri::command]
fn output_dir(app: State<'_, App>) -> Result<String, String> {
    Ok(files::output_dir(&app.root).display().to_string())
}

#[tauri::command]
fn output_set(app: State<'_, App>, dir: String) -> Result<(), String> {
    files::output_set(&app.root, &dir)
}

#[tauri::command]
fn output_list(app: State<'_, App>) -> Result<Vec<files::OutputFile>, String> {
    files::output_list(&app.root)
}

#[tauri::command]
fn output_write(app: State<'_, App>, name: String, data: String) -> Result<(), String> {
    files::output_write(&app.root, &name, &data)
}

#[tauri::command]
fn output_remove(app: State<'_, App>, name: String) -> Result<(), String> {
    files::output_remove(&app.root, &name)
}

#[tauri::command]
fn output_reveal(app: State<'_, App>, name: String) -> Result<(), String> {
    files::output_reveal(&app.root, &name)
}

#[tauri::command]
fn output_open_dir(app: State<'_, App>) -> Result<(), String> {
    files::reveal_dir(&files::output_dir(&app.root))
}

/// Open the catalogue folder itself — the one thing everybody eventually wants
/// to point a backup at.
#[tauri::command]
fn catalogue_open_dir(app: State<'_, App>) -> Result<(), String> {
    files::reveal_dir(&app.root)
}

/// 这一份是可携版吗？
///
/// 编译期定死，不在运行时猜。猜是不行的：把安装版的 exe 拖到桌面，文件系统
/// 看起来和便携版一模一样，可数据该留在原地。只有打包的人知道答案。
#[cfg(feature = "portable")]
const PORTABLE: bool = true;
#[cfg(not(feature = "portable"))]
const PORTABLE: bool = false;

/// 数据放哪儿。
///
/// 普通版在系统的应用数据目录里；便携版放在 exe 旁边，这样把整个文件夹拷到
/// U 盘、拷到另一台机器，曲谱还跟着走。
///
/// 但便携版也可能待在一个写不了的地方——Program Files、只读的 U 盘、刻进光盘
/// 的目录。那就退回应用数据目录：数据挪了地方总比启动不起来强。
fn data_root(app: &tauri::AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    if PORTABLE {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(folder) = exe.parent() {
                let beside = folder.join("Songscription Data");
                if writable(&beside) {
                    return Ok(beside);
                }
            }
        }
    }
    Ok(app.path().app_data_dir()?.join("data"))
}

/// 能不能在这个目录里写东西。真的写一次，不看属性——ACL、只读介质、公司
/// 策略都能让一个"看起来可写"的目录拒绝写入。
fn writable(folder: &std::path::Path) -> bool {
    if std::fs::create_dir_all(folder).is_err() {
        return false;
    }
    let probe = folder.join(".write-probe");
    let ok = std::fs::write(&probe, b"1").is_ok();
    let _ = std::fs::remove_file(&probe);
    ok
}

fn main() {
    // WebView2 的 GPU 进程在一部分机器上根本起不来（驱动被拉黑、沙箱被安全软件
    // 拦截都有可能），而浏览器进程的脾气是：GPU 进程反复失败后直接
    // `LOG(FATAL) "GPU process isn't usable. Goodbye."` 整个自杀。页面上第一个触发
    // GPU 初始化的东西（谱面的 2D 画布）一点开，窗口就只剩底色——库视图不碰 GPU，
    // 所以显得"只有谱面崩"。崩溃转储里四个全是同一条 FATAL，坐实了这个结论。
    //
    // 对策分三层：
    //   --disable-gpu            干脆不申请硬件加速，渲染走 CPU；
    //   --enable-unsafe-swiftshader  允许 WebGL 退到 SwiftShader（新内核要求显式允许），
    //                            背景那块着色器还能画，只是跑在 CPU 上；
    //   --disable-gpu-sandbox    万一内核仍要起一个软件 GPU 进程而它被沙箱挡住
    //                            （虚拟机里实测过这条能救），去掉沙箱让它能起。
    // 追加而非覆盖，免得用户自己设的环境变量失效。
    let mut webview_args =
        std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").unwrap_or_default();
    for flag in [
        "--disable-gpu",
        "--enable-unsafe-swiftshader",
        "--disable-gpu-sandbox",
    ] {
        if !webview_args.contains(flag) {
            webview_args.push(' ');
            webview_args.push_str(flag);
        }
    }
    std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", webview_args.trim());

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let root = data_root(app.handle())?;
            let midi_dir = root.join("midi");
            std::fs::create_dir_all(&midi_dir)?;

            let conn = db::open(&root.join("catalogue.db"))?;
            app.manage(App {
                conn: Mutex::new(conn),
                root,
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
            catalogue_dir,
            settings_all,
            settings_set,
            background_read,
            background_write,
            background_clear,
            output_dir,
            output_set,
            output_list,
            output_write,
            output_remove,
            output_reveal,
            output_open_dir,
            catalogue_open_dir
        ])
        .run(tauri::generate_context!())
        .expect("the Songscription window could not start");
}
