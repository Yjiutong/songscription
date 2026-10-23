//! The .mid files, in a folder beside the database.
//!
//! A storage name is a *name*, not a path. Every call resolves it against the
//! catalogue folder and refuses anything that could climb out of it — a row
//! that somehow held `../../.ssh/id_rsa` cannot read a file outside the store,
//! and it cannot do so by accident either, because the check is here rather
//! than in the TypeScript that built the string.

use base64::{engine::general_purpose::STANDARD, Engine};
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

/// The one gate. Kept blunt on purpose: a catalogue file name is
/// `checksum-prefix-title.mid`, so a separator or a leading dot is never
/// legitimate either.
fn resolve(dir: &Path, name: &str) -> Result<PathBuf, String> {
    let rejected = name.is_empty()
        || name.contains('/')
        || name.contains('\\')
        || name.contains("..")
        || name.starts_with('.');
    if rejected {
        return Err(format!(
            "refusing to touch \"{name}\": that is not a catalogue file name"
        ));
    }
    Ok(dir.join(name))
}

/// Write the bytes for a piece. An existing file is left alone: the name
/// carries the checksum, so an existing file *is* these bytes — it was left
/// behind by an upload whose row never landed, and reusing it is the right
/// answer rather than an error.
pub fn write(dir: &Path, name: &str, bytes: &[u8]) -> Result<(), String> {
    let path = resolve(dir, name)?;
    if path.exists() {
        return Ok(());
    }
    fs::write(&path, bytes).map_err(|error| format!("could not write {}: {error}", path.display()))
}

pub fn read(dir: &Path, name: &str) -> Result<Vec<u8>, String> {
    let path = resolve(dir, name)?;
    fs::read(&path).map_err(|error| format!("could not read {}: {error}", path.display()))
}

pub fn remove(dir: &Path, name: &str) -> Result<(), String> {
    let path = resolve(dir, name)?;
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        // Already gone is the state the caller wanted.
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("could not remove {}: {error}", path.display())),
    }
}

pub fn exists(dir: &Path, name: &str) -> Result<bool, String> {
    Ok(resolve(dir, name)?.exists())
}

pub fn reveal(dir: &Path, name: &str) -> Result<(), String> {
    let path = resolve(dir, name)?;
    show_in_file_manager(&path)
}

/// Open the machine's file manager with this file selected. The app is saying
/// "here it is" — it is not taking the person anywhere new.
#[cfg(target_os = "windows")]
fn show_in_file_manager(path: &Path) -> Result<(), String> {
    // explorer.exe exits non-zero even when it succeeds, so the spawn is the
    // only thing worth checking. `/select,` needs the path unquoted in one arg.
    std::process::Command::new("explorer")
        .arg(format!("/select,{}", path.display()))
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("could not open the file manager: {error}"))
}

#[cfg(target_os = "macos")]
fn show_in_file_manager(path: &Path) -> Result<(), String> {
    std::process::Command::new("open")
        .arg("-R")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("could not open the Finder: {error}"))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn show_in_file_manager(path: &Path) -> Result<(), String> {
    let folder = path.parent().unwrap_or(path);
    std::process::Command::new("xdg-open")
        .arg(folder)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("could not open the file manager: {error}"))
}

/// Base64 because the bridge carries JSON: a .mid is kilobytes, and encoding it
/// is cheaper in wall-clock time than teaching the boundary about binary.
pub fn encode(bytes: &[u8]) -> String {
    STANDARD.encode(bytes)
}

pub fn decode(text: &str) -> Result<Vec<u8>, String> {
    STANDARD
        .decode(text)
        .map_err(|error| format!("the file arrived corrupted: {error}"))
}
