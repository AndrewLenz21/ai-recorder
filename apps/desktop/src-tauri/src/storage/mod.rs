use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use crate::error::AppError;
use crate::library::Library;
use crate::recorder::session::{RecordingSession, SessionSummary};

pub fn app_data_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::msg(error.to_string()))?;
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn recordings_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app_data_dir(app)?.join("recordings");
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn session_dir(root: &Path, session_id: &str) -> PathBuf {
    root.join(session_id)
}

pub fn persist_session(session: &RecordingSession) -> Result<(), AppError> {
    let path = PathBuf::from(&session.directory).join("session.json");
    let json = serde_json::to_string_pretty(session)?;
    fs::write(path, json)?;
    Ok(())
}

pub fn read_session(root: &Path, session_id: &str) -> Result<RecordingSession, AppError> {
    let path = session_dir(root, session_id).join("session.json");
    let json = fs::read_to_string(&path).map_err(|_| AppError::msg("Recording not found."))?;
    Ok(serde_json::from_str(&json)?)
}

pub fn delete_session(root: &Path, session_id: &str) -> Result<(), AppError> {
    let dir = session_dir(root, session_id);
    if !dir.exists() {
        return Err(AppError::msg("Recording not found."));
    }
    fs::remove_dir_all(dir)?;
    Ok(())
}

pub fn update_session(
    root: &Path,
    session_id: &str,
    mutate: impl FnOnce(&mut RecordingSession),
) -> Result<RecordingSession, AppError> {
    let mut session = read_session(root, session_id)?;
    mutate(&mut session);
    persist_session(&session)?;
    Ok(session)
}

pub fn list_sessions(root: &Path) -> Result<Vec<SessionSummary>, AppError> {
    let mut sessions = Vec::new();
    if !root.exists() {
        return Ok(sessions);
    }

    for entry in fs::read_dir(root)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        let session_path = entry.path().join("session.json");
        let Ok(json) = fs::read_to_string(session_path) else {
            continue;
        };
        let Ok(session) = serde_json::from_str::<RecordingSession>(&json) else {
            continue;
        };
        let file_size_bytes = session_file_size(&session);
        sessions.push(SessionSummary::from_session(&session, file_size_bytes));
    }

    sessions.sort_by(|left, right| right.started_at.cmp(&left.started_at));
    Ok(sessions)
}

pub fn clear_folder_assignments(root: &Path, folder_id: &str) -> Result<(), AppError> {
    if !root.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(root)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        let path = entry.path().join("session.json");
        let Ok(json) = fs::read_to_string(&path) else {
            continue;
        };
        let Ok(mut session) = serde_json::from_str::<RecordingSession>(&json) else {
            continue;
        };
        if session.folder_id.as_deref() == Some(folder_id) {
            session.folder_id = None;
            persist_session(&session)?;
        }
    }

    Ok(())
}

pub fn library_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    Ok(app_data_dir(app)?.join("library.json"))
}

pub fn read_library(app: &AppHandle) -> Result<Library, AppError> {
    let path = library_path(app)?;
    if !path.exists() {
        return Ok(Library::default());
    }
    let json = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&json)?)
}

pub fn persist_library(app: &AppHandle, library: &Library) -> Result<(), AppError> {
    let json = serde_json::to_string_pretty(library)?;
    fs::write(library_path(app)?, json)?;
    Ok(())
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageStats {
    pub recording_count: usize,
    pub duration_ms: u64,
    pub audio_bytes: u64,
    pub screenshot_bytes: u64,
    pub used_bytes: u64,
}

pub fn storage_stats(root: &Path) -> Result<StorageStats, AppError> {
    let mut stats = StorageStats {
        recording_count: 0,
        duration_ms: 0,
        audio_bytes: 0,
        screenshot_bytes: 0,
        used_bytes: 0,
    };
    if !root.exists() {
        return Ok(stats);
    }

    for entry in fs::read_dir(root)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        let session_path = entry.path().join("session.json");
        let Ok(json) = fs::read_to_string(session_path) else {
            continue;
        };
        let Ok(session) = serde_json::from_str::<RecordingSession>(&json) else {
            continue;
        };
        let audio_bytes = audio_size(&session);
        let screenshot_bytes = screenshot_size(&session);
        stats.recording_count += 1;
        stats.duration_ms = stats.duration_ms.saturating_add(session.duration_ms);
        stats.audio_bytes = stats.audio_bytes.saturating_add(audio_bytes);
        stats.screenshot_bytes = stats.screenshot_bytes.saturating_add(screenshot_bytes);
    }
    stats.used_bytes = stats.audio_bytes.saturating_add(stats.screenshot_bytes);
    Ok(stats)
}

fn session_file_size(session: &RecordingSession) -> u64 {
    audio_size(session).saturating_add(screenshot_size(session))
}

fn audio_size(session: &RecordingSession) -> u64 {
    session
        .audio_file
        .as_ref()
        .and_then(|path| fs::metadata(path).ok())
        .map(|meta| meta.len())
        .unwrap_or(0)
}

fn screenshot_size(session: &RecordingSession) -> u64 {
    let captures = PathBuf::from(&session.directory).join("captures");
    let Ok(entries) = fs::read_dir(captures) else {
        return 0;
    };
    let mut size = 0_u64;
    for entry in entries.flatten() {
        if let Ok(meta) = entry.metadata() {
            if meta.is_file() {
                size = size.saturating_add(meta.len());
            }
        }
    }
    size
}
