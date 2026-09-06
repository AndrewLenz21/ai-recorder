use tauri::AppHandle;

use crate::ai;
use crate::error::AppError;
use crate::recorder::session::RecordingSession;
use crate::settings::{self, ProviderCapability, SettingsDto};
use crate::storage;
use crate::transcription;

#[tauri::command]
pub fn settings_get(app: AppHandle) -> Result<SettingsDto, AppError> {
    settings::dto(&app)
}

#[tauri::command]
pub fn settings_connect_provider(
    app: AppHandle,
    capability: String,
    kind: String,
    display_name: String,
    model: String,
    base_url: Option<String>,
    language: Option<String>,
    api_key: Option<String>,
    enabled_models: Option<Vec<String>>,
) -> Result<SettingsDto, AppError> {
    settings::connect(
        &app,
        parse_capability(&capability)?,
        kind,
        display_name,
        model,
        base_url,
        language,
        api_key,
        enabled_models,
    )
}

#[tauri::command]
pub fn settings_update_connection(
    app: AppHandle,
    id: String,
    display_name: Option<String>,
    model: Option<String>,
    base_url: Option<String>,
    language: Option<String>,
    api_key: Option<String>,
    clear_api_key: Option<bool>,
    enabled_models: Option<Vec<String>>,
) -> Result<SettingsDto, AppError> {
    settings::update_connection(
        &app,
        id,
        display_name,
        model,
        base_url,
        language,
        api_key,
        clear_api_key.unwrap_or(false),
        enabled_models,
    )
}

#[tauri::command]
pub fn settings_disconnect_provider(app: AppHandle, id: String) -> Result<SettingsDto, AppError> {
    settings::disconnect(&app, id)
}

#[tauri::command]
pub fn settings_set_default_provider(app: AppHandle, id: String) -> Result<SettingsDto, AppError> {
    settings::set_default(&app, id)
}

#[tauri::command]
pub async fn settings_test_connection(app: AppHandle, id: String) -> Result<(), AppError> {
    let settings = settings::read_settings(&app)?;
    let connection = settings
        .connections
        .iter()
        .find(|item| item.id == id)
        .cloned()
        .ok_or_else(|| AppError::msg("Provider not found."))?;
    match connection.capability {
        ProviderCapability::Transcription => transcription::test_connection(&connection).await,
        ProviderCapability::Ai => {
            let key = settings::get_secret(&connection.id, &connection.kind)?
                .ok_or_else(|| AppError::msg("Add an API key for this AI provider."))?;
            ai::test_connection(
                &connection.kind,
                connection.base_url.as_deref(),
                &key,
                &connection.model,
            )
            .await
        }
    }
}

#[tauri::command]
pub async fn settings_test_credentials(
    capability: String,
    kind: String,
    api_key: String,
    base_url: Option<String>,
) -> Result<(), AppError> {
    let key = crate::credentials::resolve_key(&kind, &api_key)?;
    match parse_capability(&capability)? {
        ProviderCapability::Transcription => {
            transcription::test_credentials(&kind, &key, base_url.as_deref()).await
        }
        ProviderCapability::Ai => ai::test_connection(&kind, base_url.as_deref(), &key, "").await,
    }
}

#[tauri::command]
pub async fn settings_preview_ai_models(
    kind: String,
    api_key: String,
    base_url: Option<String>,
) -> Result<Vec<crate::ai::AiModel>, AppError> {
    let key = crate::credentials::resolve_key(&kind, &api_key)?;
    ai::list_models(&kind, base_url.as_deref(), &key).await
}

#[tauri::command]
pub async fn settings_refresh_ai_models(
    app: AppHandle,
    id: String,
) -> Result<Vec<crate::ai::AiModel>, AppError> {
    let settings = settings::read_settings(&app)?;
    let connection = settings
        .connections
        .iter()
        .find(|item| item.id == id)
        .cloned()
        .ok_or_else(|| AppError::msg("Provider not found."))?;
    let key = settings::get_secret(&connection.id, &connection.kind)?
        .ok_or_else(|| AppError::msg("Add an API key for this AI provider."))?;
    ai::list_models(&connection.kind, connection.base_url.as_deref(), &key).await
}

#[tauri::command]
pub async fn settings_preview_transcription_models(
    kind: String,
    api_key: String,
    base_url: Option<String>,
) -> Result<Vec<transcription::TranscriptionModel>, AppError> {
    let key = crate::credentials::resolve_key(&kind, &api_key).unwrap_or_default();
    Ok(transcription::list_models(&kind, &key, base_url.as_deref()).await)
}

#[tauri::command]
pub async fn settings_refresh_transcription_models(
    app: AppHandle,
    id: String,
) -> Result<Vec<transcription::TranscriptionModel>, AppError> {
    let settings = settings::read_settings(&app)?;
    let connection = settings
        .connections
        .iter()
        .find(|item| item.id == id)
        .cloned()
        .ok_or_else(|| AppError::msg("Provider not found."))?;
    let key = settings::get_secret(&connection.id, &connection.kind)?.unwrap_or_default();
    Ok(transcription::list_models(&connection.kind, &key, connection.base_url.as_deref()).await)
}

#[tauri::command]
pub async fn settings_download_local_model(app: AppHandle, model_id: String) -> Result<SettingsDto, AppError> {
    settings::download_model(app, model_id).await
}

#[tauri::command]
pub fn settings_remove_local_model(app: AppHandle, model_id: String) -> Result<SettingsDto, AppError> {
    settings::remove_model(&app, model_id)
}

#[tauri::command]
pub async fn recorder_transcribe(app: AppHandle, id: String) -> Result<RecordingSession, AppError> {
    let settings = settings::read_settings(&app)?;
    let connection = settings::default_connection(&settings, ProviderCapability::Transcription)
        .cloned()
        .ok_or_else(|| AppError::msg("Connect a transcription provider in Settings."))?;
    let root = storage::recordings_dir(&app)?;
    let session = storage::read_session(&root, &id)?;
    let audio = session
        .audio_file
        .as_ref()
        .ok_or_else(|| AppError::msg("This recording has no audio."))?;
    let segments =
        transcription::transcribe_connection(&app, &connection, std::path::Path::new(audio)).await?;
    storage::update_session(&root, &id, |session| {
        session.transcript = Some(segments);
    })
}

#[tauri::command]
pub async fn recorder_generate_summary(
    app: AppHandle,
    id: String,
) -> Result<RecordingSession, AppError> {
    let settings = settings::read_settings(&app)?;
    let connection = settings::default_connection(&settings, ProviderCapability::Ai)
        .cloned()
        .ok_or_else(|| AppError::msg("Connect an AI provider in Settings."))?;
    let key = settings::get_secret(&connection.id, &connection.kind)?
        .ok_or_else(|| AppError::msg("Add an API key for this AI provider."))?;
    let root = storage::recordings_dir(&app)?;
    let session = storage::read_session(&root, &id)?;
    let segments = session
        .transcript
        .as_ref()
        .ok_or_else(|| AppError::msg("Transcribe this recording before generating a summary."))?;
    let summary = ai::generate_summary(
        &connection.kind,
        connection.base_url.as_deref(),
        &key,
        &connection.model,
        segments,
    )
    .await?;
    storage::update_session(&root, &id, |session| {
        session.summary = Some(summary);
    })
}

#[tauri::command]
pub fn credentials_has(provider_id: String) -> bool {
    crate::credentials::has_provider_secret(&provider_id)
}

#[tauri::command]
pub fn credentials_delete(provider_id: String) -> Result<(), AppError> {
    crate::credentials::delete_provider_secret(&provider_id)
}

fn parse_capability(value: &str) -> Result<ProviderCapability, AppError> {
    match value {
        "transcription" => Ok(ProviderCapability::Transcription),
        "ai" => Ok(ProviderCapability::Ai),
        _ => Err(AppError::msg("Unknown provider capability.")),
    }
}
