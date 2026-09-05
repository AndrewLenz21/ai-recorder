use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::permissions::{self, PermissionsStatus};
use crate::state::AppState;

#[tauri::command]
pub fn permissions_status(_state: State<AppState>) -> PermissionsStatus {
    permissions::status()
}

#[tauri::command]
pub fn permissions_request(kind: String) -> Result<PermissionsStatus, AppError> {
    permissions::request(&kind)
}

#[tauri::command]
pub fn permissions_open_settings(app: AppHandle, kind: String) -> Result<(), AppError> {
    permissions::open_settings(&app, &kind)
}
