use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::screen_capture;
use crate::state::AppState;
use crate::timeline::RecordingEvent;

#[tauri::command]
pub fn screen_capture_take(
    app: AppHandle,
    state: State<AppState>,
) -> Result<RecordingEvent, AppError> {
    let (path, file_name) = state.recorder.next_capture_name()?;
    screen_capture::capture_primary_to_file(&path)?;
    state.recorder.attach_screen_capture(&app, path, file_name)
}
