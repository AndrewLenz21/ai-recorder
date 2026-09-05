use tauri::{AppHandle, State};

use crate::recorder::session::RecordingStatus;
use crate::state::AppState;

use crate::error::AppError;
use crate::library::{
    create_folder, normalize_name, validate_color, validate_icon, LibrarySnapshot, RecordingFolder,
};
use crate::recorder::RecordingSession;
use crate::storage::{self, StorageStats};
use crate::timeline::now_rfc3339;

#[tauri::command]
pub fn library_get(app: AppHandle) -> Result<LibrarySnapshot, AppError> {
    Ok(storage::read_library(&app)?.into())
}

#[tauri::command]
pub fn library_storage_stats(app: AppHandle) -> Result<StorageStats, AppError> {
    let root = storage::recordings_dir(&app)?;
    storage::storage_stats(&root)
}

#[tauri::command]
pub fn library_create_folder(
    app: AppHandle,
    name: String,
    icon: String,
    color: String,
) -> Result<RecordingFolder, AppError> {
    let mut library = storage::read_library(&app)?;
    let folder = create_folder(name, icon, color)?;
    library.folders.push(folder.clone());
    storage::persist_library(&app, &library)?;
    Ok(folder)
}

#[tauri::command]
pub fn library_update_folder(
    app: AppHandle,
    id: String,
    name: String,
    icon: String,
    color: String,
) -> Result<RecordingFolder, AppError> {
    let mut library = storage::read_library(&app)?;
    let folder = library
        .folders
        .iter_mut()
        .find(|folder| folder.id == id)
        .ok_or_else(|| AppError::msg("Folder not found."))?;
    folder.name = normalize_name(&name)?;
    validate_icon(&icon)?;
    validate_color(&color)?;
    folder.icon = icon;
    folder.color = color;
    folder.updated_at = now_rfc3339();
    let updated = folder.clone();
    storage::persist_library(&app, &library)?;
    Ok(updated)
}

#[tauri::command]
pub fn library_delete_folder(app: AppHandle, id: String) -> Result<LibrarySnapshot, AppError> {
    let mut library = storage::read_library(&app)?;
    let before = library.folders.len();
    library.folders.retain(|folder| folder.id != id);
    if library.folders.len() == before {
        return Err(AppError::msg("Folder not found."));
    }
    if library.default_folder_id.as_deref() == Some(id.as_str()) {
        library.default_folder_id = None;
    }
    let root = storage::recordings_dir(&app)?;
    storage::clear_folder_assignments(&root, &id)?;
    storage::persist_library(&app, &library)?;
    Ok(library.into())
}

#[tauri::command]
pub fn library_set_default_folder(
    app: AppHandle,
    folder_id: Option<String>,
) -> Result<LibrarySnapshot, AppError> {
    let mut library = storage::read_library(&app)?;
    if let Some(folder_id) = folder_id.as_ref() {
        if !library.folders.iter().any(|folder| folder.id == *folder_id) {
            return Err(AppError::msg("Folder not found."));
        }
    }
    library.default_folder_id = folder_id;
    storage::persist_library(&app, &library)?;
    Ok(library.into())
}

#[tauri::command]
pub fn recorder_rename_session(
    app: AppHandle,
    id: String,
    title: String,
) -> Result<RecordingSession, AppError> {
    let root = storage::recordings_dir(&app)?;
    let title = title.trim();
    let title = if title.is_empty() {
        None
    } else {
        Some(title.to_string())
    };
    storage::update_session(&root, &id, |session| {
        session.title = title;
    })
}

#[tauri::command]
pub fn recorder_move_session(
    app: AppHandle,
    id: String,
    folder_id: Option<String>,
) -> Result<RecordingSession, AppError> {
    if let Some(folder_id) = folder_id.as_ref() {
        let library = storage::read_library(&app)?;
        if !library.folders.iter().any(|folder| folder.id == *folder_id) {
            return Err(AppError::msg("Folder not found."));
        }
    }
    let root = storage::recordings_dir(&app)?;
    storage::update_session(&root, &id, |session| {
        session.folder_id = folder_id;
    })
}

#[tauri::command]
pub fn recorder_delete_session(
    app: AppHandle,
    state: State<AppState>,
    id: String,
) -> Result<(), AppError> {
    let snapshot = state.recorder.snapshot();
    let live = snapshot.session.as_ref().map(|session| session.id.as_str()) == Some(id.as_str());
    if live
        && matches!(
            snapshot.status,
            RecordingStatus::Recording | RecordingStatus::Paused | RecordingStatus::Stopping
        )
    {
        return Err(AppError::msg("Stop the recording before deleting it."));
    }
    let root = storage::recordings_dir(&app)?;
    storage::delete_session(&root, &id)
}
