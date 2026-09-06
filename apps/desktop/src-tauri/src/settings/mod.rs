use std::collections::HashSet;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::error::AppError;
use crate::storage::app_data_dir;

mod secrets;

pub use secrets::{delete_secret, get_secret, has_secret, key_hint, set_secret};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum ProviderCapability {
    Transcription,
    Ai,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConnection {
    pub id: String,
    pub capability: ProviderCapability,
    #[serde(rename = "type")]
    pub kind: String,
    pub display_name: String,
    pub model: String,
    #[serde(default)]
    pub is_default: bool,
    #[serde(default)]
    pub base_url: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub enabled_models: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SettingsFile {
    #[serde(default)]
    pub connections: Vec<ProviderConnection>,
    #[serde(default)]
    pub transcription_provider: Option<String>,
    #[serde(default)]
    pub transcription_model: String,
    #[serde(default)]
    pub transcription_language: String,
    #[serde(default)]
    pub ai_provider: Option<String>,
    #[serde(default)]
    pub ai_model: String,
    #[serde(default)]
    pub ai_custom_model: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConnectionDto {
    pub id: String,
    pub capability: ProviderCapability,
    #[serde(rename = "type")]
    pub kind: String,
    pub display_name: String,
    pub model: String,
    pub is_default: bool,
    pub base_url: Option<String>,
    pub language: Option<String>,
    pub enabled_models: Vec<String>,
    pub has_credential: bool,
    pub credential_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModelDto {
    pub id: String,
    pub label: String,
    pub filename: String,
    pub bytes: u64,
    pub installed: bool,
    pub recommended: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsDto {
    pub connections: Vec<ProviderConnectionDto>,
    pub local_models: Vec<LocalModelDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelProgress {
    pub id: String,
    pub received: u64,
    pub total: u64,
}

const LOCAL_MODELS: [(&str, &str, &str, u64, bool); 5] = [
    ("tiny", "Tiny", "ggml-tiny.bin", 73_000_000, false),
    ("base", "Base", "ggml-base.bin", 141_000_000, false),
    ("small", "Small", "ggml-small.bin", 465_000_000, true),
    ("medium", "Medium", "ggml-medium.bin", 1_400_000_000, false),
    ("large", "Large", "ggml-large-v3.bin", 2_900_000_000, false),
];

fn settings_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    Ok(app_data_dir(app)?.join("settings.json"))
}

pub fn models_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app_data_dir(app)?.join("models").join("whisper");
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn read_json<T: for<'de> Deserialize<'de> + Default>(path: &Path) -> Result<T, AppError> {
    if !path.exists() {
        return Ok(T::default());
    }
    let json = fs::read_to_string(path)?;
    if json.trim().is_empty() {
        return Ok(T::default());
    }
    Ok(serde_json::from_str(&json)?)
}

pub fn read_settings(app: &AppHandle) -> Result<SettingsFile, AppError> {
    let mut settings = read_json::<SettingsFile>(&settings_path(app)?)?;
    migrate_legacy(&mut settings, app)?;
    let before = settings.connections.len();
    settings.connections = dedupe_connections(settings.connections);
    if settings.connections.len() != before {
        save_settings(app, &settings)?;
    }
    Ok(settings)
}

fn dedupe_connections(connections: Vec<ProviderConnection>) -> Vec<ProviderConnection> {
    let mut seen = HashSet::new();
    let mut unique = Vec::new();
    for connection in connections {
        let key = if connection.kind == "openai-compatible" {
            format!(
                "{:?}:{}:{}",
                connection.capability,
                connection.kind,
                connection.base_url.clone().unwrap_or_default()
            )
        } else {
            format!("{:?}:{}", connection.capability, connection.kind)
        };
        if seen.insert(key) {
            unique.push(connection);
        }
    }
    unique
}

fn migrate_legacy(settings: &mut SettingsFile, app: &AppHandle) -> Result<(), AppError> {
    if !settings.connections.is_empty() {
        return Ok(());
    }
    if let Some(provider) = settings.transcription_provider.clone() {
        let id = Uuid::new_v4().to_string();
        if let Ok(legacy) = read_json::<LegacySecrets>(&app_data_dir(app)?.join("secrets.json")) {
            if !legacy.transcription_api_key.trim().is_empty() {
                let _ = set_secret(&id, &provider, &legacy.transcription_api_key);
            }
        }
        settings.connections.push(ProviderConnection {
            id,
            capability: ProviderCapability::Transcription,
            kind: provider,
            display_name: "Transcription".to_string(),
            model: if settings.transcription_model.trim().is_empty() {
                "whisper-1".to_string()
            } else {
                settings.transcription_model.clone()
            },
            is_default: true,
            base_url: None,
            language: Some(if settings.transcription_language.trim().is_empty() {
                "auto".to_string()
            } else {
                settings.transcription_language.clone()
            }),
            enabled_models: Vec::new(),
        });
    }
    if let Some(provider) = settings.ai_provider.clone() {
        let id = Uuid::new_v4().to_string();
        if let Ok(legacy) = read_json::<LegacySecrets>(&app_data_dir(app)?.join("secrets.json")) {
            if !legacy.ai_api_key.trim().is_empty() {
                let _ = set_secret(&id, &provider, &legacy.ai_api_key);
            }
        }
        settings.connections.push(ProviderConnection {
            id,
            capability: ProviderCapability::Ai,
            kind: provider,
            display_name: "AI".to_string(),
            model: settings
                .ai_custom_model
                .clone()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| settings.ai_model.clone()),
            is_default: true,
            base_url: None,
            language: None,
            enabled_models: Vec::new(),
        });
    }
    if !settings.connections.is_empty() {
        save_settings(app, settings)?;
    }
    Ok(())
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct LegacySecrets {
    #[serde(default)]
    transcription_api_key: String,
    #[serde(default)]
    ai_api_key: String,
}

pub fn save_settings(app: &AppHandle, settings: &SettingsFile) -> Result<(), AppError> {
    let json = serde_json::to_string_pretty(settings)?;
    fs::write(settings_path(app)?, json)?;
    Ok(())
}

fn to_dto(connection: &ProviderConnection) -> ProviderConnectionDto {
    let secret = get_secret(&connection.id, &connection.kind).ok().flatten();
    ProviderConnectionDto {
        id: connection.id.clone(),
        capability: connection.capability.clone(),
        kind: connection.kind.clone(),
        display_name: connection.display_name.clone(),
        model: connection.model.clone(),
        is_default: connection.is_default,
        base_url: connection.base_url.clone(),
        language: connection.language.clone(),
        enabled_models: connection.enabled_models.clone(),
        has_credential: has_secret(&connection.id, &connection.kind),
        credential_hint: secret.as_deref().and_then(key_hint),
    }
}

pub fn local_models(app: &AppHandle) -> Result<Vec<LocalModelDto>, AppError> {
    let dir = models_dir(app)?;
    Ok(LOCAL_MODELS
        .iter()
        .map(|(id, label, filename, bytes, recommended)| LocalModelDto {
            id: (*id).to_string(),
            label: (*label).to_string(),
            filename: (*filename).to_string(),
            bytes: *bytes,
            installed: dir.join(filename).exists(),
            recommended: *recommended,
        })
        .collect())
}

pub fn dto(app: &AppHandle) -> Result<SettingsDto, AppError> {
    let settings = read_settings(app)?;
    Ok(SettingsDto {
        connections: settings.connections.iter().map(to_dto).collect(),
        local_models: local_models(app)?,
    })
}

pub fn default_connection(
    settings: &SettingsFile,
    capability: ProviderCapability,
) -> Option<&ProviderConnection> {
    settings
        .connections
        .iter()
        .find(|item| item.capability == capability && item.is_default)
        .or_else(|| {
            settings
                .connections
                .iter()
                .find(|item| item.capability == capability)
        })
}

pub fn connect(
    app: &AppHandle,
    capability: ProviderCapability,
    kind: String,
    display_name: String,
    model: String,
    base_url: Option<String>,
    language: Option<String>,
    api_key: Option<String>,
    enabled_models: Option<Vec<String>>,
) -> Result<SettingsDto, AppError> {
    let mut settings = read_settings(app)?;
    let needs_key = kind != "local";
    let key = api_key.as_deref().map(str::trim).filter(|value| !value.is_empty());
    let existing = (kind != "openai-compatible").then(|| {
        settings.connections.iter().position(|item| {
            item.capability == capability && item.kind == kind
        })
    }).flatten();

    if let Some(index) = existing {
        let id = settings.connections[index].id.clone();
        if let Some(key) = key {
            set_secret(&id, &kind, key)?;
        } else if needs_key && !has_secret(&id, &kind) {
            return Err(AppError::msg("Add an API key to connect this provider."));
        }
        let connection = &mut settings.connections[index];
        connection.display_name = display_name;
        connection.model = model;
        connection.base_url = normalize_optional(base_url);
        connection.language = normalize_optional(language);
        if let Some(models) = enabled_models {
            connection.enabled_models = models;
        }
        if needs_key && !has_secret(&id, &kind) {
            return Err(AppError::msg("Could not save the API key in the system keychain."));
        }
        save_settings(app, &settings)?;
        return dto(app);
    }

    let id = Uuid::new_v4().to_string();
    let same = settings
        .connections
        .iter()
        .any(|item| item.capability == capability);
    if let Some(key) = key {
        set_secret(&id, &kind, key)?;
    } else if needs_key && !has_secret(&id, &kind) {
        return Err(AppError::msg("Add an API key to connect this provider."));
    }
    settings.connections.push(ProviderConnection {
        id: id.clone(),
        capability,
        kind: kind.clone(),
        display_name,
        model,
        is_default: !same,
        base_url: normalize_optional(base_url),
        language: normalize_optional(language),
        enabled_models: enabled_models.unwrap_or_default(),
    });
    if needs_key && !has_secret(&id, &kind) {
        return Err(AppError::msg("Could not save the API key in the system keychain."));
    }
    save_settings(app, &settings)?;
    dto(app)
}

pub fn update_connection(
    app: &AppHandle,
    id: String,
    display_name: Option<String>,
    model: Option<String>,
    base_url: Option<String>,
    language: Option<String>,
    api_key: Option<String>,
    clear_api_key: bool,
    enabled_models: Option<Vec<String>>,
) -> Result<SettingsDto, AppError> {
    let mut settings = read_settings(app)?;
    let kind = {
        let connection = settings
            .connections
            .iter_mut()
            .find(|item| item.id == id)
            .ok_or_else(|| AppError::msg("Provider not found."))?;
        if let Some(value) = display_name.filter(|item| !item.trim().is_empty()) {
            connection.display_name = value;
        }
        if let Some(value) = model.filter(|item| !item.trim().is_empty()) {
            connection.model = value;
        }
        if let Some(value) = base_url {
            connection.base_url = normalize_optional(Some(value));
        }
        if let Some(value) = language {
            connection.language = normalize_optional(Some(value));
        }
        if let Some(models) = enabled_models {
            connection.enabled_models = models;
            if !connection.enabled_models.iter().any(|item| item == &connection.model) {
                connection.model = connection
                    .enabled_models
                    .first()
                    .cloned()
                    .unwrap_or_default();
            }
        }
        connection.kind.clone()
    };
    if clear_api_key {
        let keep_vendor = settings
            .connections
            .iter()
            .any(|item| item.id != id && item.kind == kind);
        let _ = delete_secret(&id, &kind, keep_vendor);
    } else if let Some(key) = api_key.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
        set_secret(&id, &kind, key)?;
    }
    save_settings(app, &settings)?;
    dto(app)
}

pub fn disconnect(app: &AppHandle, id: String) -> Result<SettingsDto, AppError> {
    let mut settings = read_settings(app)?;
    let removed = settings
        .connections
        .iter()
        .find(|item| item.id == id)
        .cloned()
        .ok_or_else(|| AppError::msg("Provider not found."))?;
    let keep_vendor = settings
        .connections
        .iter()
        .any(|item| item.id != id && item.kind == removed.kind);
    settings.connections.retain(|item| item.id != id);
    let _ = delete_secret(&id, &removed.kind, keep_vendor);
    if removed.is_default {
        if let Some(next) = settings
            .connections
            .iter_mut()
            .find(|item| item.capability == removed.capability)
        {
            next.is_default = true;
        }
    }
    save_settings(app, &settings)?;
    dto(app)
}

pub fn set_default(app: &AppHandle, id: String) -> Result<SettingsDto, AppError> {
    let mut settings = read_settings(app)?;
    let capability = settings
        .connections
        .iter()
        .find(|item| item.id == id)
        .map(|item| item.capability.clone())
        .ok_or_else(|| AppError::msg("Provider not found."))?;
    for connection in &mut settings.connections {
        if connection.capability == capability {
            connection.is_default = connection.id == id;
        }
    }
    save_settings(app, &settings)?;
    dto(app)
}

pub fn normalize_optional(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

pub fn model_path(app: &AppHandle, model_id: &str) -> Result<PathBuf, AppError> {
    let info = LOCAL_MODELS
        .iter()
        .find(|(id, ..)| *id == model_id)
        .ok_or_else(|| AppError::msg("Unknown local model."))?;
    Ok(models_dir(app)?.join(info.2))
}

pub async fn download_model(app: AppHandle, model_id: String) -> Result<SettingsDto, AppError> {
    let info = LOCAL_MODELS
        .iter()
        .find(|(id, ..)| *id == model_id)
        .ok_or_else(|| AppError::msg("Unknown local model."))?;
    let path = models_dir(&app)?.join(info.2);
    if path.exists() {
        return dto(&app);
    }
    let url = format!(
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/{}",
        info.2
    );
    let tmp = path.with_extension("bin.partial");
    let response = reqwest::Client::new().get(url).send().await?;
    if !response.status().is_success() {
        return Err(AppError::msg("Could not download the Whisper model."));
    }
    let total = response.content_length().unwrap_or(info.3);
    let mut file = fs::File::create(&tmp)?;
    let mut received = 0_u64;
    let mut body = response;
    while let Some(chunk) = body.chunk().await? {
        file.write_all(&chunk)?;
        received += chunk.len() as u64;
        let _ = app.emit(
            "settings:model-progress",
            ModelProgress {
                id: model_id.clone(),
                received,
                total,
            },
        );
    }
    file.flush()?;
    fs::rename(tmp, path)?;
    dto(&app)
}

pub fn remove_model(app: &AppHandle, model_id: String) -> Result<SettingsDto, AppError> {
    let path = model_path(app, &model_id)?;
    if path.exists() {
        fs::remove_file(path)?;
    }
    dto(app)
}
