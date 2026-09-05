use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::recorder::{RecorderStateDto, RecordingSession, SessionSummary};
use crate::state::AppState;
use crate::storage;

#[tauri::command]
pub fn recorder_start(
    app: AppHandle,
    state: State<AppState>,
) -> Result<RecorderStateDto, AppError> {
    state.recorder.start(&app)
}

#[tauri::command]
pub fn recorder_pause(
    app: AppHandle,
    state: State<AppState>,
) -> Result<RecorderStateDto, AppError> {
    state.recorder.pause(&app)
}

#[tauri::command]
pub fn recorder_resume(
    app: AppHandle,
    state: State<AppState>,
) -> Result<RecorderStateDto, AppError> {
    state.recorder.resume(&app)
}

#[tauri::command]
pub fn recorder_stop(
    app: AppHandle,
    state: State<AppState>,
) -> Result<RecorderStateDto, AppError> {
    state.recorder.stop(&app)
}

#[tauri::command]
pub fn recorder_dismiss(
    app: AppHandle,
    state: State<AppState>,
) -> Result<RecorderStateDto, AppError> {
    state.recorder.dismiss(&app)
}

#[tauri::command]
pub fn recorder_state(state: State<AppState>) -> RecorderStateDto {
    state.recorder.snapshot()
}

#[tauri::command]
pub fn recorder_list_sessions(app: AppHandle) -> Result<Vec<SessionSummary>, AppError> {
    let root = storage::recordings_dir(&app)?;
    storage::list_sessions(&root)
}

#[tauri::command]
pub fn recorder_get_session(
    app: AppHandle,
    id: String,
) -> Result<RecordingSession, AppError> {
    let root = storage::recordings_dir(&app)?;
    storage::read_session(&root, &id)
}
