//! 界面替自己保管的几样东西。
//!
//! 曲是 MIDI 的，分析是 TypeScript 的；这个文件里的东西没有一条属于音乐：
//! 一张背景图、一沓导出来的谱面、几行偏好。它们仍然要落在磁盘上而不是
//! localStorage——这是一个桌面应用，说要换台机器就得走得掉。
//!
//! 布局：
//!
//!   <root>/catalogue.db        数据库（db.rs）
//!   <root>/midi/               曲谱原件（storage.rs）
//!   <root>/settings.json       偏好
//!   <root>/background          背景图，原始字节，类型记在 settings 里
//!   <root>/exports/            导出的谱面（默认的输出目录，可以换）

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::{json, Map, Value};

use crate::storage::{decode, encode, resolve};

/// 设置里记背景图 MIME 的那个键。
pub const BACKGROUND_MIME: &str = "background.mime";
/// 设置里记输出目录的那个键。
const OUTPUT_DIR: &str = "output.dir";

// --- 设置 ------------------------------------------------------------------

/// 读一张 key/value 表回来。文件坏了就当它没有：一个人宁可丢掉自己的背景图
/// 设置，也不愿意因为这个打不开自己的曲谱册。
pub fn read_settings(root: &Path) -> Map<String, Value> {
    let Ok(text) = fs::read_to_string(root.join("settings.json")) else {
        return Map::new();
    };
    serde_json::from_str::<Map<String, Value>>(&text).unwrap_or_default()
}

fn write_settings(root: &Path, table: &Map<String, Value>) -> Result<(), String> {
    let text = serde_json::to_string_pretty(table)
        .map_err(|error| format!("the settings could not be written: {error}"))?;
    fs::write(root.join("settings.json"), text)
        .map_err(|error| format!("the settings could not be written: {error}"))
}

pub fn set_setting(root: &Path, key: &str, value: Value) -> Result<(), String> {
    let mut table = read_settings(root);
    table.insert(key.to_string(), value);
    write_settings(root, &table)
}

fn get_setting(root: &Path, key: &str) -> Option<String> {
    read_settings(root)
        .get(key)
        .and_then(|value| value.as_str())
        .map(str::to_string)
}

// --- 背景图 ----------------------------------------------------------------

pub fn background_path(root: &Path) -> PathBuf {
    root.join("background")
}

pub fn background_read(root: &Path) -> Option<(String, String)> {
    let mime = get_setting(root, BACKGROUND_MIME)?;
    let bytes = fs::read(background_path(root)).ok()?;
    Some((mime, encode(&bytes)))
}

pub fn background_write(root: &Path, data: &str, mime: &str) -> Result<(), String> {
    // 先写文件再记账，反过来会得到一个"记录说有图、图却没有"的坏状态。
    let bytes = decode(data)?;
    fs::write(background_path(root), bytes)
        .map_err(|error| format!("the background could not be saved: {error}"))?;
    set_setting(root, BACKGROUND_MIME, json!(mime))
}

pub fn background_clear(root: &Path) -> Result<(), String> {
    let path = background_path(root);
    match fs::remove_file(&path) {
        Ok(()) => {}
        // 已经不在了——这正是调用方想要的状态。
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("the background could not be removed: {error}")),
    }
    set_setting(root, BACKGROUND_MIME, Value::Null)
}

// --- 输出目录 --------------------------------------------------------------

/// 那个人说了要往哪儿存就是哪儿；没说过就是数据目录里的 exports/。
pub fn output_dir(root: &Path) -> PathBuf {
    match get_setting(root, OUTPUT_DIR) {
        Some(dir) if !dir.trim().is_empty() => PathBuf::from(dir),
        _ => root.join("exports"),
    }
}

pub fn output_set(root: &Path, dir: &str) -> Result<(), String> {
    let trimmed = dir.trim();
    if trimmed.is_empty() {
        return Err("give it a folder, or leave it blank to go back to the default".to_string());
    }
    let path = PathBuf::from(trimmed);
    fs::create_dir_all(&path)
        .map_err(|error| format!("that folder could not be used: {error}"))?;
    // 真的写一个文件进去试探：一个能 mkdir 却写不进去的目录（权限、配额、只
    // 读介质）要到导出第三页的时候才报错，那时人已经等了半分钟。
    let probe = path.join(".probe");
    fs::write(&probe, b"1")
        .map_err(|error| format!("that folder cannot be written to: {error}"))?;
    let _ = fs::remove_file(&probe);
    set_setting(root, OUTPUT_DIR, json!(trimmed))
}

/// 目录里的一份文件。`name` 是文件名，不是路径——对角线仍由 resolve() 把着。
#[derive(serde::Serialize)]
pub struct OutputFile {
    pub name: String,
    pub bytes: u64,
    pub modified: u64,
}

pub fn output_list(root: &Path) -> Result<Vec<OutputFile>, String> {
    let dir = output_dir(root);
    let entries = match fs::read_dir(&dir) {
        Ok(entries) => entries,
        // 还没导过东西，目录不存在——空列表比错误更像实话。
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
        Err(error) => return Err(format!("the output folder could not be listed: {error}")),
    };

    let mut files = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|error| format!("a file could not be read: {error}"))?;
        let Ok(meta) = entry.metadata() else { continue };
        if !meta.is_file() {
            continue;
        }
        files.push(OutputFile {
            name: entry.file_name().to_string_lossy().to_string(),
            bytes: meta.len(),
            modified: seconds(&meta),
        });
    }
    // 新的在上面：刚刚导出来的那一份就是人正要去找的那一份。
    files.sort_by(|a, b| b.modified.cmp(&a.modified).then(a.name.cmp(&b.name)));
    Ok(files)
}

pub fn output_write(root: &Path, name: &str, data: &str) -> Result<(), String> {
    let dir = output_dir(root);
    fs::create_dir_all(&dir)
        .map_err(|error| format!("the output folder could not be made: {error}"))?;
    let path = resolve(&dir, name)?;
    let bytes = decode(data)?;
    fs::write(&path, bytes)
        .map_err(|error| format!("could not write {}: {error}", path.display()))
}

pub fn output_remove(root: &Path, name: &str) -> Result<(), String> {
    let path = resolve(&output_dir(root), name)?;
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("could not remove {}: {error}", path.display())),
    }
}

pub fn output_reveal(root: &Path, name: &str) -> Result<(), String> {
    let dir = output_dir(root);
    let path = resolve(&dir, name)?;
    if !path.exists() {
        // 文件不在了就把人领到那个目录：他要找的东西多半就在眼前。
        return reveal_dir(&dir);
    }
    crate::storage::show_in_file_manager(&path)
}

pub fn reveal_dir(dir: &Path) -> Result<(), String> {
    let _ = fs::create_dir_all(dir);
    show(dir)
}

#[cfg(target_os = "windows")]
fn show(path: &Path) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("could not open the file manager: {error}"))
}

#[cfg(target_os = "macos")]
fn show(path: &Path) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("could not open the Finder: {error}"))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn show(path: &Path) -> Result<(), String> {
    std::process::Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("could not open the file manager: {error}"))
}

fn seconds(meta: &fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|at| at.duration_since(UNIX_EPOCH).ok())
        .map(|ago| ago.as_secs())
        .unwrap_or(0)
}

#[allow(dead_code)]
fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|ago| ago.as_secs())
        .unwrap_or(0)
}
