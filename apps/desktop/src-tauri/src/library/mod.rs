use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::timeline::now_rfc3339;

pub const FOLDER_ICONS: [&str; 11] = [
    "folder",
    "briefcase",
    "microphone",
    "lightbulb",
    "book",
    "code",
    "people",
    "video",
    "graduation",
    "star",
    "archive",
];

pub const FOLDER_COLORS: [&str; 8] = [
    "blue", "purple", "green", "orange", "red", "pink", "teal", "gray",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingFolder {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub color: String,
    #[serde(default)]
    pub parent_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Library {
    #[serde(default)]
    pub folders: Vec<RecordingFolder>,
    #[serde(default)]
    pub default_folder_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySnapshot {
    pub folders: Vec<RecordingFolder>,
    pub default_folder_id: Option<String>,
}

impl From<Library> for LibrarySnapshot {
    fn from(library: Library) -> Self {
        let default_folder_id = library
            .default_folder_id
            .as_ref()
            .filter(|id| library.folders.iter().any(|folder| folder.id == **id))
            .cloned();
        Self {
            folders: library.folders,
            default_folder_id,
        }
    }
}

pub fn validate_icon(icon: &str) -> Result<(), AppError> {
    if FOLDER_ICONS.contains(&icon) {
        Ok(())
    } else {
        Err(AppError::msg("Choose a folder icon."))
    }
}

pub fn validate_color(color: &str) -> Result<(), AppError> {
    if FOLDER_COLORS.contains(&color) {
        Ok(())
    } else {
        Err(AppError::msg("Choose a folder color."))
    }
}

pub fn create_folder(
    name: String,
    icon: String,
    color: String,
    parent_id: Option<String>,
) -> Result<RecordingFolder, AppError> {
    let name = normalize_name(&name)?;
    validate_icon(&icon)?;
    validate_color(&color)?;
    let now = now_rfc3339();
    Ok(RecordingFolder {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        icon,
        color,
        parent_id,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn folder_depth(folders: &[RecordingFolder], id: &str) -> usize {
    let mut depth = 0;
    let mut current_id = Some(id);
    let mut seen = 0;
    while let Some(id) = current_id {
        if seen > folders.len() {
            break;
        }
        let folder = folders.iter().find(|folder| folder.id == id);
        match folder.and_then(|folder| folder.parent_id.as_deref()) {
            Some(parent_id) => {
                depth += 1;
                current_id = Some(parent_id);
            }
            None => break,
        }
        seen += 1;
    }
    depth
}

pub fn normalize_name(name: &str) -> Result<String, AppError> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::msg("Give this folder a name."));
    }
    if name.chars().count() > 48 {
        return Err(AppError::msg("Folder names can be 48 characters."));
    }
    Ok(name.to_string())
}
