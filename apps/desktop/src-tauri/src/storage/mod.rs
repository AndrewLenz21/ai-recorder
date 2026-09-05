use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use crate::error::AppError;
use crate::recorder::session::{RecordingSession, SessionSummary};

pub fn recordings_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::msg(error.to_string()))?
        .join("recordings");
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
        sessions.push(SessionSummary::from(&session));
    }

    sessions.sort_by(|left, right| right.started_at.cmp(&left.started_at));
    Ok(sessions)
}
