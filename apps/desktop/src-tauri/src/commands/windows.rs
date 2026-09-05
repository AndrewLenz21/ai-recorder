use tauri::AppHandle;

use crate::error::AppError;
use crate::windows;

#[tauri::command]
pub fn window_show_main(app: AppHandle) -> Result<(), AppError> {
    windows::show_main(&app)
}

#[tauri::command]
pub fn window_show_widget(app: AppHandle) -> Result<(), AppError> {
    windows::show_widget(&app)
}

#[tauri::command]
pub fn window_hide_widget(app: AppHandle) -> Result<(), AppError> {
    windows::hide_widget(&app)
}
