use std::path::Path;

use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::recorder::session::TranscriptSegment;
use crate::settings::ProviderConnection;

mod local;

const NOVITA_ASR_MODEL_ID: &str = "zai-org/glm-asr-2512";
const NOVITA_ASR_MODEL_NAME: &str = "GLM-ASR-2512";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionModel {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
struct WhisperResponse {
    text: Option<String>,
    #[serde(default)]
    segments: Vec<WhisperSegment>,
}

#[derive(Debug, Deserialize)]
struct WhisperSegment {
    start: Option<f64>,
    end: Option<f64>,
    text: Option<String>,
}

fn endpoint(kind: &str, base_url: Option<&str>) -> Result<String, AppError> {
    match kind {
        "openai" => Ok("https://api.openai.com/v1/audio/transcriptions".to_string()),
        "groq" => Ok("https://api.groq.com/openai/v1/audio/transcriptions".to_string()),
        "novita" => Ok("https://api.novita.ai/v3/openai/audio/transcriptions".to_string()),
        "openai-compatible" => {
            let base = base_url
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| AppError::msg("Add a base URL for this provider."))?;
            Ok(format!("{}/audio/transcriptions", base.trim_end_matches('/')))
        }
        "deepgram" | "assemblyai" => Ok(String::new()),
        _ => Err(AppError::msg("Unsupported transcription provider.")),
    }
}

fn default_model(provider: &str, model: &str) -> String {
    if !model.trim().is_empty() {
        return model.trim().to_string();
    }
    match provider {
        "groq" => "whisper-large-v3".to_string(),
        "novita" => NOVITA_ASR_MODEL_ID.to_string(),
        _ => "whisper-1".to_string(),
    }
}

fn to_segments(response: WhisperResponse) -> Vec<TranscriptSegment> {
    if !response.segments.is_empty() {
        return response
            .segments
            .into_iter()
            .filter_map(|segment| {
                let text = segment.text.unwrap_or_default().trim().to_string();
                if text.is_empty() {
                    return None;
                }
                Some(TranscriptSegment {
                    id: Uuid::new_v4().to_string(),
                    start_ms: (segment.start.unwrap_or(0.0) * 1000.0).max(0.0) as u64,
                    end_ms: (segment.end.unwrap_or(0.0) * 1000.0).max(0.0) as u64,
                    text,
                })
            })
            .collect();
    }

    let text = response.text.unwrap_or_default().trim().to_string();
    if text.is_empty() {
        return Vec::new();
    }
    vec![TranscriptSegment {
        id: format!("segment-{index}", index = 0),
        start_ms: 0,
        end_ms: 0,
        text,
    }]
}

fn format_api_error(status: u16, body: &str) -> String {
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(body) {
        if let Some(message) = value
            .pointer("/error/message")
            .or_else(|| value.get("message"))
            .and_then(|item| item.as_str())
        {
            return message.to_string();
        }
    }
    format!("Transcription failed ({status}).")
}

pub async fn transcribe_connection(
    app: &tauri::AppHandle,
    connection: &ProviderConnection,
    audio_path: &Path,
) -> Result<Vec<TranscriptSegment>, AppError> {
    if connection.kind == "local" {
        let model = connection.model.clone();
        let path = audio_path.to_path_buf();
        let handle = app.clone();
        return tauri::async_runtime::spawn_blocking(move || local::transcribe(&handle, &model, &path))
            .await
            .map_err(|error| AppError::msg(error.to_string()))?;
    }
    let api_key = crate::settings::get_secret(&connection.id, &connection.kind)?
        .ok_or_else(|| AppError::msg("Add an API key for this transcription provider."))?;
    let language = connection.language.as_deref().unwrap_or("auto");
    match connection.kind.as_str() {
        "deepgram" => transcribe_deepgram(&api_key, &connection.model, language, audio_path).await,
        "assemblyai" => transcribe_assemblyai(&api_key, language, audio_path).await,
        "novita" => transcribe_novita(&api_key, &connection.model, language, audio_path).await,
        _ => {
            transcribe_url(
                &endpoint(&connection.kind, connection.base_url.as_deref())?,
                &api_key,
                &connection.kind,
                &connection.model,
                language,
                audio_path,
            )
            .await
        }
    }
}

async fn transcribe_url(
    url: &str,
    api_key: &str,
    provider: &str,
    model: &str,
    language: &str,
    audio_path: &Path,
) -> Result<Vec<TranscriptSegment>, AppError> {
    let bytes = std::fs::read(audio_path)?;
    let file_name = audio_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("audio.wav")
        .to_string();
    let mut form = Form::new()
        .part(
            "file",
            Part::bytes(bytes)
                .file_name(file_name)
                .mime_str("audio/wav")
                .map_err(|error| AppError::msg(error.to_string()))?,
        )
        .text("model", default_model(provider, model))
        .text("response_format", "verbose_json");
    if !language.is_empty() && language != "auto" {
        form = form.text("language", language.to_string());
    }
    let response = reqwest::Client::new()
        .post(url)
        .bearer_auth(api_key.trim())
        .multipart(form)
        .send()
        .await?;
    let status = response.status();
    let body = response.text().await?;
    if !status.is_success() {
        return Err(AppError::msg(format_api_error(status.as_u16(), &body)));
    }
    let parsed: WhisperResponse =
        serde_json::from_str(&body).map_err(|_| AppError::msg("Could not parse transcription response."))?;
    let segments = to_segments(parsed);
    if segments.is_empty() {
        return Err(AppError::msg("The transcription provider returned no text."));
    }
    Ok(segments)
}

const NOVITA_CHUNK_MS: u64 = 28_000;

fn wav_chunks(path: &Path) -> Result<Vec<(u64, Vec<u8>)>, AppError> {
    let mut reader = hound::WavReader::open(path)?;
    let spec = reader.spec();
    let samples: Vec<i16> = reader.samples::<i16>().collect::<Result<_, _>>()?;
    let channels = spec.channels.max(1) as u64;
    let rate = spec.sample_rate.max(1) as u64;
    let chunk_samples = ((rate * NOVITA_CHUNK_MS / 1000) * channels) as usize;
    if chunk_samples == 0 {
        return Err(AppError::msg("Could not split this recording for Novita."));
    }
    let mut chunks = Vec::new();
    let mut offset = 0_usize;
    let mut offset_ms = 0_u64;
    while offset < samples.len() {
        let end = (offset + chunk_samples).min(samples.len());
        let aligned = end - ((end - offset) as u64 % channels) as usize;
        let slice = &samples[offset..aligned.max(offset)];
        if slice.is_empty() {
            break;
        }
        chunks.push((offset_ms, write_wav_bytes(spec, slice)?));
        offset = aligned;
        offset_ms += NOVITA_CHUNK_MS;
    }
    if chunks.is_empty() {
        return Err(AppError::msg("This recording has no audio to transcribe."));
    }
    Ok(chunks)
}

fn write_wav_bytes(spec: hound::WavSpec, samples: &[i16]) -> Result<Vec<u8>, AppError> {
    let mut cursor = std::io::Cursor::new(Vec::new());
    {
        let mut writer = hound::WavWriter::new(&mut cursor, spec)?;
        for sample in samples {
            writer.write_sample(*sample)?;
        }
        writer.finalize()?;
    }
    Ok(cursor.into_inner())
}

fn merge_segments(segments: Vec<TranscriptSegment>) -> Vec<TranscriptSegment> {
    let mut merged: Vec<TranscriptSegment> = Vec::new();
    for segment in segments {
        if let Some(previous) = merged.last_mut() {
            let close = segment.start_ms <= previous.end_ms.saturating_add(450);
            let open_ended = !previous.text.ends_with(['.', '?', '!', '。', '？', '！']);
            if close && open_ended {
                previous.text = format!("{} {}", previous.text.trim(), segment.text.trim());
                previous.end_ms = previous.end_ms.max(segment.end_ms);
                continue;
            }
        }
        merged.push(segment);
    }
    merged
}

async fn transcribe_novita(
    api_key: &str,
    model: &str,
    language: &str,
    audio_path: &Path,
) -> Result<Vec<TranscriptSegment>, AppError> {
    let url = endpoint("novita", None)?;
    let chunks = wav_chunks(audio_path)?;
    let mut combined = Vec::new();
    for (offset_ms, bytes) in chunks {
        let mut segments = transcribe_bytes(&url, api_key, "novita", model, language, bytes).await?;
        for segment in &mut segments {
            segment.start_ms = segment.start_ms.saturating_add(offset_ms);
            segment.end_ms = segment.end_ms.saturating_add(offset_ms);
            if segment.end_ms < segment.start_ms {
                segment.end_ms = segment.start_ms;
            }
        }
        combined.extend(segments);
    }
    let merged = merge_segments(combined);
    if merged.is_empty() {
        return Err(AppError::msg("Novita returned no text."));
    }
    Ok(merged)
}

async fn transcribe_bytes(
    url: &str,
    api_key: &str,
    provider: &str,
    model: &str,
    language: &str,
    bytes: Vec<u8>,
) -> Result<Vec<TranscriptSegment>, AppError> {
    let mut form = Form::new()
        .part(
            "file",
            Part::bytes(bytes)
                .file_name("chunk.wav")
                .mime_str("audio/wav")
                .map_err(|error| AppError::msg(error.to_string()))?,
        )
        .text("model", default_model(provider, model));
    if !language.is_empty() && language != "auto" {
        form = form.text("language", language.to_string());
    }
    let response = reqwest::Client::new()
        .post(url)
        .bearer_auth(api_key.trim())
        .multipart(form)
        .send()
        .await?;
    let status = response.status();
    let body = response.text().await?;
    if !status.is_success() {
        return Err(AppError::msg(format_api_error(status.as_u16(), &body)));
    }
    let parsed: WhisperResponse = serde_json::from_str(&body).unwrap_or(WhisperResponse {
        text: serde_json::from_str::<serde_json::Value>(&body)
            .ok()
            .and_then(|value| value.get("text")?.as_str().map(|text| text.to_string())),
        segments: Vec::new(),
    });
    Ok(to_segments(parsed))
}

pub async fn test_connection(connection: &ProviderConnection) -> Result<(), AppError> {
    if connection.kind == "local" {
        return test_credentials("local", "", None).await;
    }
    let api_key = crate::settings::get_secret(&connection.id, &connection.kind)?
        .ok_or_else(|| AppError::msg("Add an API key for this transcription provider."))?;
    test_credentials(&connection.kind, &api_key, connection.base_url.as_deref()).await
}

pub async fn test_credentials(kind: &str, api_key: &str, base_url: Option<&str>) -> Result<(), AppError> {
    if kind == "local" {
        if !local::runtime_available() {
            return Err(AppError::msg(
                "whisper-cli was not found. Install whisper.cpp to run local transcription.",
            ));
        }
        return Ok(());
    }
    if api_key.trim().is_empty() {
        return Err(AppError::msg("Add an API key to test this provider."));
    }
    match kind {
        "deepgram" => {
            test_header(
                "https://api.deepgram.com/v1/projects",
                &format!("Token {}", api_key.trim()),
            )
            .await
        }
        "assemblyai" => test_header("https://api.assemblyai.com/v2/account", api_key.trim()).await,
        _ => {
            let models = endpoint(kind, base_url)?.replace("/audio/transcriptions", "/models");
            test_bearer(&models, api_key.trim()).await
        }
    }
}

async fn test_header(url: &str, authorization: &str) -> Result<(), AppError> {
    let response = reqwest::Client::new()
        .get(url)
        .header("Authorization", authorization)
        .send()
        .await?;
    if !response.status().is_success() {
        return Err(AppError::msg("Could not reach this transcription provider."));
    }
    Ok(())
}

async fn test_bearer(url: &str, api_key: &str) -> Result<(), AppError> {
    let response = reqwest::Client::new()
        .get(url)
        .bearer_auth(api_key)
        .send()
        .await?;
    if !response.status().is_success() {
        return Err(AppError::msg("Could not reach this transcription provider."));
    }
    Ok(())
}

fn documented_novita_asr() -> TranscriptionModel {
    TranscriptionModel {
        id: NOVITA_ASR_MODEL_ID.to_string(),
        name: NOVITA_ASR_MODEL_NAME.to_string(),
    }
}

fn is_asr_model(id: &str) -> bool {
    let id = id.to_lowercase();
    id.contains("asr")
        || id.contains("whisper")
        || id.contains("transcribe")
        || id.contains("speech-to-text")
        || id.contains("speech_to_text")
}

fn asr_model_name(id: &str, item: &serde_json::Value) -> String {
    if id.ends_with("glm-asr-2512") {
        return NOVITA_ASR_MODEL_NAME.to_string();
    }
    item.get("display_name")
        .or_else(|| item.get("displayName"))
        .or_else(|| item.get("name"))
        .and_then(|value| value.as_str())
        .map(|value| value.to_string())
        .unwrap_or_else(|| id.rsplit('/').next().unwrap_or(id).to_string())
}

async fn list_novita_asr(api_key: &str) -> Vec<TranscriptionModel> {
    let documented = documented_novita_asr();
    if api_key.trim().is_empty() {
        return vec![documented];
    }
    let response = reqwest::Client::new()
        .get("https://api.novita.ai/v3/openai/models")
        .bearer_auth(api_key.trim())
        .send()
        .await;
    let Ok(response) = response else {
        return vec![documented];
    };
    let Ok(body) = response.text().await else {
        return vec![documented];
    };
    let Ok(value) = serde_json::from_str::<serde_json::Value>(&body) else {
        return vec![documented];
    };
    let rows = value
        .get("data")
        .or_else(|| value.get("models"))
        .and_then(|item| item.as_array())
        .cloned()
        .unwrap_or_default();
    let mut models: Vec<TranscriptionModel> = rows
        .into_iter()
        .filter_map(|item| {
            let id = item.get("id").and_then(|value| value.as_str())?.trim().to_string();
            if id.is_empty() || !is_asr_model(&id) {
                return None;
            }
            Some(TranscriptionModel {
                name: asr_model_name(&id, &item),
                id,
            })
        })
        .collect();
    if !models.iter().any(|item| item.id == documented.id) {
        models.insert(0, documented.clone());
    }
    models.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    models.dedup_by(|left, right| left.id == right.id);
    if models.is_empty() {
        vec![documented]
    } else {
        models
    }
}

pub async fn list_models(kind: &str, api_key: &str, _base_url: Option<&str>) -> Vec<TranscriptionModel> {
    if kind == "novita" {
        return list_novita_asr(api_key).await;
    }
    Vec::new()
}

async fn transcribe_deepgram(
    api_key: &str,
    model: &str,
    language: &str,
    audio_path: &Path,
) -> Result<Vec<TranscriptSegment>, AppError> {
    let bytes = std::fs::read(audio_path)?;
    let mut url = format!(
        "https://api.deepgram.com/v1/listen?model={}&smart_format=true&utterances=true",
        if model.trim().is_empty() { "nova-2" } else { model }
    );
    if language != "auto" && !language.is_empty() {
        url.push_str(&format!("&language={language}"));
    }
    let response = reqwest::Client::new()
        .post(url)
        .header("Authorization", format!("Token {}", api_key.trim()))
        .header("Content-Type", "audio/wav")
        .body(bytes)
        .send()
        .await?;
    let status = response.status();
    let body = response.text().await?;
    if !status.is_success() {
        return Err(AppError::msg(format_api_error(status.as_u16(), &body)));
    }
    let value: serde_json::Value = serde_json::from_str(&body)?;
    let utterances = value
        .pointer("/results/utterances")
        .and_then(|item| item.as_array())
        .cloned()
        .unwrap_or_default();
    let mut segments = Vec::new();
    for item in utterances {
        let text = item
            .get("transcript")
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        if text.is_empty() {
            continue;
        }
        segments.push(TranscriptSegment {
            id: Uuid::new_v4().to_string(),
            start_ms: (item.get("start").and_then(|value| value.as_f64()).unwrap_or(0.0) * 1000.0) as u64,
            end_ms: (item.get("end").and_then(|value| value.as_f64()).unwrap_or(0.0) * 1000.0) as u64,
            text,
        });
    }
    if segments.is_empty() {
        if let Some(text) = value
            .pointer("/results/channels/0/alternatives/0/transcript")
            .and_then(|item| item.as_str())
        {
            if !text.trim().is_empty() {
                segments.push(TranscriptSegment {
                    id: Uuid::new_v4().to_string(),
                    start_ms: 0,
                    end_ms: 0,
                    text: text.trim().to_string(),
                });
            }
        }
    }
    if segments.is_empty() {
        return Err(AppError::msg("Deepgram returned no text."));
    }
    Ok(segments)
}

async fn transcribe_assemblyai(
    api_key: &str,
    language: &str,
    audio_path: &Path,
) -> Result<Vec<TranscriptSegment>, AppError> {
    let bytes = std::fs::read(audio_path)?;
    let upload = reqwest::Client::new()
        .post("https://api.assemblyai.com/v2/upload")
        .header("Authorization", api_key.trim())
        .body(bytes)
        .send()
        .await?;
    if !upload.status().is_success() {
        return Err(AppError::msg("Could not upload audio to AssemblyAI."));
    }
    let uploaded: serde_json::Value = upload.json().await?;
    let audio_url = uploaded
        .get("upload_url")
        .and_then(|item| item.as_str())
        .ok_or_else(|| AppError::msg("AssemblyAI did not return an upload URL."))?;
    let mut payload = serde_json::json!({ "audio_url": audio_url });
    if language != "auto" && !language.is_empty() {
        payload["language_code"] = serde_json::Value::String(language.to_string());
    }
    let created = reqwest::Client::new()
        .post("https://api.assemblyai.com/v2/transcript")
        .header("Authorization", api_key.trim())
        .json(&payload)
        .send()
        .await?;
    if !created.status().is_success() {
        return Err(AppError::msg("AssemblyAI could not start transcription."));
    }
    let created_body: serde_json::Value = created.json().await?;
    let id = created_body
        .get("id")
        .and_then(|item| item.as_str())
        .ok_or_else(|| AppError::msg("AssemblyAI did not return a transcript id."))?
        .to_string();
    let poll_url = format!("https://api.assemblyai.com/v2/transcript/{id}");
    for _ in 0..60 {
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        let poll = reqwest::Client::new()
            .get(&poll_url)
            .header("Authorization", api_key.trim())
            .send()
            .await?;
        let body: serde_json::Value = poll.json().await?;
        let status = body.get("status").and_then(|item| item.as_str()).unwrap_or("");
        if status == "error" {
            return Err(AppError::msg(
                body.get("error")
                    .and_then(|item| item.as_str())
                    .unwrap_or("AssemblyAI transcription failed.")
                    .to_string(),
            ));
        }
        if status != "completed" {
            continue;
        }
        let mut segments = Vec::new();
        if let Some(words) = body.get("words").and_then(|item| item.as_array()) {
            let mut current = String::new();
            let mut start_ms = 0_u64;
            let mut end_ms = 0_u64;
            for word in words {
                let token = word.get("text").and_then(|item| item.as_str()).unwrap_or("");
                let word_start = word.get("start").and_then(|item| item.as_u64()).unwrap_or(0);
                let word_end = word.get("end").and_then(|item| item.as_u64()).unwrap_or(word_start);
                if current.is_empty() {
                    start_ms = word_start;
                }
                if !current.is_empty() {
                    current.push(' ');
                }
                current.push_str(token);
                end_ms = word_end;
                if token.ends_with('.') || token.ends_with('?') || token.ends_with('!') {
                    segments.push(TranscriptSegment {
                        id: Uuid::new_v4().to_string(),
                        start_ms,
                        end_ms,
                        text: current.trim().to_string(),
                    });
                    current.clear();
                }
            }
            if !current.trim().is_empty() {
                segments.push(TranscriptSegment {
                    id: Uuid::new_v4().to_string(),
                    start_ms,
                    end_ms,
                    text: current.trim().to_string(),
                });
            }
        }
        if segments.is_empty() {
            if let Some(text) = body.get("text").and_then(|item| item.as_str()) {
                if !text.trim().is_empty() {
                    segments.push(TranscriptSegment {
                        id: Uuid::new_v4().to_string(),
                        start_ms: 0,
                        end_ms: 0,
                        text: text.trim().to_string(),
                    });
                }
            }
        }
        if segments.is_empty() {
            return Err(AppError::msg("AssemblyAI returned no text."));
        }
        return Ok(segments);
    }
    Err(AppError::msg("AssemblyAI transcription timed out."))
}
