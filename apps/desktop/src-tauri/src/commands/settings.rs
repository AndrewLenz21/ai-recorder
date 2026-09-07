use tauri::{AppHandle, Emitter};

use crate::ai;
use crate::error::AppError;
use crate::recorder::session::{AudioTrackKind, RecordingSession, TranscriptSource};
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
pub async fn settings_download_whisper_runtime(app: AppHandle) -> Result<SettingsDto, AppError> {
    settings::download_runtime(app).await
}

#[tauri::command]
pub fn settings_remove_local_model(app: AppHandle, model_id: String) -> Result<SettingsDto, AppError> {
    settings::remove_model(&app, model_id)
}

fn archive_transcript(session: &mut crate::recorder::session::RecordingSession) {
    let Some(segments) = session.transcript.take() else {
        return;
    };
    if segments.is_empty() {
        session.transcript = Some(segments);
        return;
    }
    session.transcript_history.insert(
        0,
        crate::recorder::session::TranscriptRun {
            id: uuid::Uuid::new_v4().to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
            provider: session.transcript_provider.clone().unwrap_or_else(|| "Unknown".to_string()),
            model: session.transcript_model.clone().unwrap_or_default(),
            language: session.transcript_language.clone(),
            source: session.transcript_source,
            segments,
        },
    );
    session.transcript_history.truncate(8);
}

#[tauri::command]
pub async fn recorder_transcribe(
    app: AppHandle,
    id: String,
    provider_id: Option<String>,
    model: Option<String>,
    source: Option<String>,
) -> Result<RecordingSession, AppError> {
    let _ = app.emit("transcription:stage", "preparing");
    let settings = settings::read_settings(&app)?;
    let mut connection = if let Some(provider_id) = provider_id {
        settings
            .connections
            .iter()
            .find(|item| item.id == provider_id)
            .cloned()
            .ok_or_else(|| AppError::msg("Transcription provider not found."))?
    } else {
        settings::default_connection(&settings, ProviderCapability::Transcription)
            .cloned()
            .ok_or_else(|| AppError::msg("Connect a transcription provider in Settings."))?
    };
    if let Some(model) = model.filter(|value| !value.trim().is_empty()) {
        connection.model = model;
    }
    let root = storage::recordings_dir(&app)?;
    let session = storage::read_session(&root, &id)?;
    let source = TranscriptSource::parse(source.as_deref().or(Some(session.default_transcript_source().as_str())));
    let _ = app.emit("transcription:stage", "transcribing");
    let (segments, language) = if source == TranscriptSource::Both {
        transcribe_conversation(&app, &connection, &session).await?
    } else {
        let audio = resolve_transcript_audio(&session, source)?;
        let (mut segments, language) =
            transcription::transcribe_connection(&app, &connection, std::path::Path::new(&audio)).await?;
        if matches!(source, TranscriptSource::Microphone | TranscriptSource::System) {
            for segment in &mut segments {
                segment.source = Some(source);
            }
        }
        (segments, language)
    };
    let _ = app.emit("transcription:stage", "timestamps");
    let provider = connection.display_name.clone();
    let model = connection.model.clone();
    storage::update_session(&root, &id, |session| {
        archive_transcript(session);
        session.transcript = Some(segments);
        session.transcript_provider = Some(provider);
        session.transcript_model = Some(model);
        session.transcript_language = language;
        session.transcript_source = Some(source);
    })
}

#[tauri::command]
pub fn recorder_restore_transcript(app: AppHandle, id: String, run_id: String) -> Result<RecordingSession, AppError> {
    let root = storage::recordings_dir(&app)?;
    storage::update_session(&root, &id, |session| {
        let position = session
            .transcript_history
            .iter()
            .position(|item| item.id == run_id);
        let Some(position) = position else {
            return;
        };
        let run = session.transcript_history.remove(position);
        archive_transcript(session);
        session.transcript = Some(run.segments);
        session.transcript_provider = Some(run.provider);
        session.transcript_model = Some(run.model);
        session.transcript_language = run.language;
        session.transcript_source = run.source;
    })
}

#[tauri::command]
pub async fn recorder_generate_summary(
    app: AppHandle,
    id: String,
    provider_id: Option<String>,
    model: Option<String>,
) -> Result<RecordingSession, AppError> {
    let settings = settings::read_settings(&app)?;
    let mut connection = if let Some(provider_id) = provider_id {
        settings
            .connections
            .iter()
            .find(|item| item.id == provider_id)
            .cloned()
            .ok_or_else(|| AppError::msg("AI provider not found."))?
    } else {
        settings::default_connection(&settings, ProviderCapability::Ai)
            .cloned()
            .ok_or_else(|| AppError::msg("Connect an AI provider in Settings."))?
    };
    if let Some(model) = model.filter(|value| !value.trim().is_empty()) {
        connection.model = model;
    }
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

async fn transcribe_conversation(
    app: &AppHandle,
    connection: &crate::settings::ProviderConnection,
    session: &RecordingSession,
) -> Result<(Vec<crate::recorder::session::TranscriptSegment>, Option<String>), AppError> {
    let mic = resolve_transcript_audio(session, TranscriptSource::Microphone).ok();
    let system = resolve_transcript_audio(session, TranscriptSource::System).ok();
    if mic.is_none() && system.is_none() {
        return Err(AppError::msg("This recording has no audio tracks to transcribe."));
    }
    let mut merged = Vec::new();
    let mut language = None;
    if let Some(path) = mic {
        let (segments, detected) = transcribe_track(app, connection, &path, TranscriptSource::Microphone).await?;
        if language.is_none() {
            language = detected;
        }
        merged.extend(segments);
    }
    if let Some(path) = system {
        let (segments, detected) = transcribe_track(app, connection, &path, TranscriptSource::System).await?;
        if language.is_none() {
            language = detected;
        }
        merged.extend(segments);
    }
    if merged.is_empty() {
        return Err(AppError::msg("Transcription returned no text from either track."));
    }
    merged.sort_by(|left, right| {
        left.start_ms
            .cmp(&right.start_ms)
            .then_with(|| source_rank(left.source).cmp(&source_rank(right.source)))
    });
    Ok((merged, language))
}

async fn transcribe_track(
    app: &AppHandle,
    connection: &crate::settings::ProviderConnection,
    path: &str,
    source: TranscriptSource,
) -> Result<(Vec<crate::recorder::session::TranscriptSegment>, Option<String>), AppError> {
    match transcription::transcribe_connection(app, connection, std::path::Path::new(path)).await {
        Ok((segments, language)) => Ok((
            segments
                .into_iter()
                .map(|segment| segment.with_source(source))
                .collect(),
            language,
        )),
        Err(error) if error.to_string().to_ascii_lowercase().contains("no text") => Ok((Vec::new(), None)),
        Err(error) => Err(error),
    }
}

fn source_rank(source: Option<TranscriptSource>) -> u8 {
    match source {
        Some(TranscriptSource::Microphone) => 0,
        Some(TranscriptSource::System) => 1,
        _ => 2,
    }
}

fn resolve_transcript_audio(
    session: &RecordingSession,
    source: TranscriptSource,
) -> Result<String, AppError> {
    let path_for = |kind: AudioTrackKind| session.track(kind).map(|track| track.path.clone());
    match source {
        TranscriptSource::Microphone => path_for(AudioTrackKind::Microphone)
            .or_else(|| session.audio_file.clone())
            .ok_or_else(|| AppError::msg("This recording has no microphone track.")),
        TranscriptSource::System => path_for(AudioTrackKind::System)
            .ok_or_else(|| AppError::msg("This recording has no system audio track.")),
        TranscriptSource::Both => Err(AppError::msg("Conversation mode transcribes each track separately.")),
        TranscriptSource::Mixed => {
            if let Some(mixed) = path_for(AudioTrackKind::Mixed) {
                return Ok(mixed);
            }
            match (path_for(AudioTrackKind::Microphone), path_for(AudioTrackKind::System)) {
                (Some(mic), Some(system)) => {
                    let output = std::path::PathBuf::from(&session.directory).join("mixed.wav");
                    crate::recorder::mix_wavs(std::path::Path::new(&mic), std::path::Path::new(&system), &output)?;
                    Ok(output.to_string_lossy().to_string())
                }
                (Some(path), None) | (None, Some(path)) => Ok(path),
                (None, None) => session
                    .audio_file
                    .clone()
                    .ok_or_else(|| AppError::msg("This recording has no audio.")),
            }
        }
    }
}

fn parse_capability(value: &str) -> Result<ProviderCapability, AppError> {
    match value {
        "transcription" => Ok(ProviderCapability::Transcription),
        "ai" => Ok(ProviderCapability::Ai),
        _ => Err(AppError::msg("Unknown provider capability.")),
    }
}
