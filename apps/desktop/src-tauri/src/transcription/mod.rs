use std::path::Path;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::error::AppError;
use crate::recorder::session::{TranscriptSegment, TranscriptWord};
use crate::settings::ProviderConnection;

pub mod local;

const NOVITA_ASR_MODEL_ID: &str = "zai-org/glm-asr-2512";
const NOVITA_ASR_MODEL_NAME: &str = "GLM-ASR-2512";
const NOVITA_ASR_URL: &str = "https://api.novita.ai/v3/glm-asr";
const NOVITA_CHUNK_MS: u64 = 28_000;
const NOVITA_MAX_BYTES: usize = 25 * 1024 * 1024;

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
    #[serde(default)]
    words: Vec<WhisperWord>,
}

#[derive(Debug, Deserialize)]
struct WhisperSegment {
    start: Option<f64>,
    end: Option<f64>,
    text: Option<String>,
    #[serde(default)]
    words: Vec<WhisperWord>,
}

#[derive(Debug, Deserialize)]
struct WhisperWord {
    #[serde(alias = "word")]
    text: Option<String>,
    start: Option<f64>,
    end: Option<f64>,
}

fn endpoint(kind: &str, base_url: Option<&str>) -> Result<String, AppError> {
    match kind {
        "openai" => Ok("https://api.openai.com/v1/audio/transcriptions".to_string()),
        "groq" => Ok("https://api.groq.com/openai/v1/audio/transcriptions".to_string()),
        "novita" => Ok(NOVITA_ASR_URL.to_string()),
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

fn seconds_to_ms(value: f64) -> u64 {
    (value.max(0.0) * 1000.0).round() as u64
}

fn whisper_words(items: &[WhisperWord]) -> Vec<TranscriptWord> {
    items
        .iter()
        .filter_map(|item| {
            let text = item.text.as_deref().unwrap_or("").trim();
            if text.is_empty() {
                return None;
            }
            let start = seconds_to_ms(item.start.unwrap_or(0.0));
            let end = seconds_to_ms(item.end.unwrap_or(item.start.unwrap_or(0.0))).max(start);
            Some(TranscriptWord {
                start_ms: start,
                end_ms: end,
                text: text.to_string(),
            })
        })
        .collect()
}

fn assign_words(segments: &mut [TranscriptSegment], words: Vec<TranscriptWord>) {
    if words.is_empty() {
        return;
    }
    for segment in segments.iter_mut() {
        if !segment.words.is_empty() {
            continue;
        }
        segment.words = words
            .iter()
            .filter(|word| word.start_ms >= segment.start_ms && word.start_ms < segment.end_ms.max(segment.start_ms.saturating_add(1)))
            .cloned()
            .collect();
    }
    if segments.len() == 1 && segments[0].words.is_empty() {
        segments[0].words = words;
    }
}

fn to_segments(response: WhisperResponse) -> Vec<TranscriptSegment> {
    let top_words = whisper_words(&response.words);
    if !response.segments.is_empty() {
        let mut segments = response
            .segments
            .into_iter()
            .filter_map(|segment| {
                let text = segment.text.unwrap_or_default().trim().to_string();
                if text.is_empty() {
                    return None;
                }
                Some(
                    TranscriptSegment::new(
                        seconds_to_ms(segment.start.unwrap_or(0.0)),
                        seconds_to_ms(segment.end.unwrap_or(0.0)),
                        text,
                    )
                    .with_words(whisper_words(&segment.words)),
                )
            })
            .collect::<Vec<_>>();
        assign_words(&mut segments, top_words);
        return segments;
    }

    let text = response.text.unwrap_or_default().trim().to_string();
    if text.is_empty() {
        return Vec::new();
    }
    vec![TranscriptSegment::new(0, 0, text).with_words(top_words)]
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
) -> Result<(Vec<TranscriptSegment>, Option<String>), AppError> {
    let language = connection.language.as_deref().unwrap_or("auto");
    if connection.kind == "local" {
        let model = connection.model.clone();
        let path = audio_path.to_path_buf();
        let lang = language.to_string();
        let handle = app.clone();
        return tauri::async_runtime::spawn_blocking(move || local::transcribe(&handle, &model, &path, &lang))
            .await
            .map_err(|error| AppError::msg(error.to_string()))?;
    }
    let api_key = crate::settings::get_secret(&connection.id, &connection.kind)?
        .ok_or_else(|| AppError::msg("Add an API key for this transcription provider."))?;
    let segments = match connection.kind.as_str() {
        "deepgram" => transcribe_deepgram(&api_key, &connection.model, language, audio_path).await?,
        "assemblyai" => transcribe_assemblyai(&api_key, language, audio_path).await?,
        "novita" => transcribe_novita(&api_key, &connection.model, language, audio_path).await?,
        _ => {
            transcribe_url(
                &endpoint(&connection.kind, connection.base_url.as_deref())?,
                &api_key,
                &connection.kind,
                &connection.model,
                language,
                audio_path,
            )
            .await?
        }
    };
    let detected = if language == "auto" || language.is_empty() {
        None
    } else {
        Some(language.to_string())
    };
    Ok((segments, detected))
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
    let send = |with_words: bool| {
        let mut form = Form::new()
            .part(
                "file",
                Part::bytes(bytes.clone())
                    .file_name(file_name.clone())
                    .mime_str("audio/wav")
                    .map_err(|error| AppError::msg(error.to_string()))?,
            )
            .text("model", default_model(provider, model))
            .text("response_format", "verbose_json");
        if with_words {
            form = form
                .text("timestamp_granularities[]", "word")
                .text("timestamp_granularities[]", "segment");
        }
        if !language.is_empty() && language != "auto" {
            form = form.text("language", language.to_string());
        }
        Ok::<_, AppError>(form)
    };
    let client = reqwest::Client::new();
    let mut response = client
        .post(url)
        .bearer_auth(api_key.trim())
        .multipart(send(true)?)
        .send()
        .await?;
    if !response.status().is_success() {
        response = client
            .post(url)
            .bearer_auth(api_key.trim())
            .multipart(send(false)?)
            .send()
            .await?;
    }
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

fn log_novita_asr(url: &str, status: u16, body: &str) {
    #[cfg(debug_assertions)]
    {
        let clipped: String = body.chars().take(800).collect();
        eprintln!("[novita-asr] POST {url} status={status} body={clipped}");
    }
}

fn novita_asr_error(url: &str, status: u16, body: &str) -> AppError {
    log_novita_asr(url, status, body);
    let detail = format_api_error(status, body);
    AppError::msg(format!("{detail} ({status} {url})"))
}

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
        let bytes = write_wav_bytes(spec, slice)?;
        if bytes.len() > NOVITA_MAX_BYTES {
            return Err(AppError::msg("Novita GLM-ASR accepts files up to 25 MB."));
        }
        chunks.push((offset_ms, bytes));
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
                previous.kind = crate::recorder::session::TranscriptKind::from_text(&previous.text);
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
    _model: &str,
    _language: &str,
    audio_path: &Path,
) -> Result<Vec<TranscriptSegment>, AppError> {
    let chunks = wav_chunks(audio_path)?;
    let mut combined = Vec::new();
    let mut prompt = String::new();
    for (offset_ms, bytes) in chunks {
        let text = transcribe_glm_asr(api_key, bytes, &prompt).await?;
        let trimmed = text.trim();
        if trimmed.is_empty() {
            continue;
        }
        combined.push(TranscriptSegment::new(
            offset_ms,
            offset_ms.saturating_add(NOVITA_CHUNK_MS),
            trimmed.to_string(),
        ));
        prompt = if prompt.is_empty() {
            trimmed.to_string()
        } else {
            format!("{prompt} {trimmed}")
        };
        if prompt.chars().count() > 8000 {
            prompt = prompt.chars().skip(prompt.chars().count() - 8000).collect();
        }
    }
    let merged = merge_segments(combined);
    if merged.is_empty() {
        return Err(AppError::msg("Novita returned no text."));
    }
    Ok(merged)
}

fn glm_asr_text(body: &str) -> Option<String> {
    let value: serde_json::Value = serde_json::from_str(body).ok()?;
    value
        .get("text")
        .or_else(|| value.pointer("/data/text"))
        .or_else(|| value.pointer("/result/text"))
        .and_then(|item| item.as_str())
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}

async fn transcribe_glm_asr(api_key: &str, bytes: Vec<u8>, prompt: &str) -> Result<String, AppError> {
    if bytes.len() > NOVITA_MAX_BYTES {
        return Err(AppError::msg("Novita GLM-ASR accepts files up to 25 MB."));
    }
    let encoded = STANDARD.encode(&bytes);
    let mut body = json!({
        "model": NOVITA_ASR_MODEL_NAME,
        "file": format!("data:audio/wav;base64,{encoded}"),
    });
    if !prompt.trim().is_empty() {
        body["prompt"] = json!(prompt);
    }
    let response = reqwest::Client::new()
        .post(NOVITA_ASR_URL)
        .header("Content-Type", "application/json")
        .bearer_auth(api_key.trim())
        .json(&body)
        .send()
        .await?;
    let status = response.status();
    let body = response.text().await?;
    log_novita_asr(NOVITA_ASR_URL, status.as_u16(), &body);
    if status.is_success() {
        return glm_asr_text(&body).ok_or_else(|| AppError::msg("Novita returned no text."));
    }
    if matches!(status.as_u16(), 400 | 422) {
        return transcribe_glm_asr_raw(api_key, encoded, prompt).await;
    }
    Err(novita_asr_error(NOVITA_ASR_URL, status.as_u16(), &body))
}

async fn transcribe_glm_asr_raw(api_key: &str, encoded: String, prompt: &str) -> Result<String, AppError> {
    let mut body = json!({
        "model": NOVITA_ASR_MODEL_NAME,
        "file": encoded,
    });
    if !prompt.trim().is_empty() {
        body["prompt"] = json!(prompt);
    }
    let response = reqwest::Client::new()
        .post(NOVITA_ASR_URL)
        .header("Content-Type", "application/json")
        .bearer_auth(api_key.trim())
        .json(&body)
        .send()
        .await?;
    let status = response.status();
    let body = response.text().await?;
    log_novita_asr(NOVITA_ASR_URL, status.as_u16(), &body);
    if !status.is_success() {
        return Err(novita_asr_error(NOVITA_ASR_URL, status.as_u16(), &body));
    }
    glm_asr_text(&body).ok_or_else(|| AppError::msg("Novita returned no text."))
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
        "novita" => test_novita_asr(api_key.trim()).await,
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

fn silent_wav() -> Vec<u8> {
    write_wav_bytes(
        hound::WavSpec {
            channels: 1,
            sample_rate: 16_000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        },
        &[0; 1600],
    )
    .unwrap_or_default()
}

async fn test_novita_asr(api_key: &str) -> Result<(), AppError> {
    let encoded = STANDARD.encode(silent_wav());
    let response = reqwest::Client::new()
        .post(NOVITA_ASR_URL)
        .header("Content-Type", "application/json")
        .bearer_auth(api_key)
        .json(&json!({
            "model": NOVITA_ASR_MODEL_NAME,
            "file": format!("data:audio/wav;base64,{encoded}"),
        }))
        .send()
        .await?;
    let status = response.status();
    let body = response.text().await?;
    log_novita_asr(NOVITA_ASR_URL, status.as_u16(), &body);
    if status.is_success() || matches!(status.as_u16(), 400 | 422) {
        return Ok(());
    }
    if matches!(status.as_u16(), 401 | 403) {
        return Err(AppError::msg("Novita rejected this API key."));
    }
    Err(novita_asr_error(NOVITA_ASR_URL, status.as_u16(), &body))
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

pub async fn list_models(kind: &str, _api_key: &str, _base_url: Option<&str>) -> Vec<TranscriptionModel> {
    if kind == "novita" {
        return vec![documented_novita_asr()];
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
        let words = item
            .get("words")
            .and_then(|value| value.as_array())
            .map(|words| {
                words
                    .iter()
                    .filter_map(|word| {
                        let token = word
                            .get("word")
                            .or_else(|| word.get("punctuated_word"))
                            .and_then(|value| value.as_str())
                            .unwrap_or("")
                            .trim();
                        if token.is_empty() {
                            return None;
                        }
                        Some(TranscriptWord {
                            start_ms: seconds_to_ms(word.get("start").and_then(|value| value.as_f64()).unwrap_or(0.0)),
                            end_ms: seconds_to_ms(word.get("end").and_then(|value| value.as_f64()).unwrap_or(0.0)),
                            text: token.to_string(),
                        })
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        segments.push(
            TranscriptSegment::new(
                seconds_to_ms(item.get("start").and_then(|value| value.as_f64()).unwrap_or(0.0)),
                seconds_to_ms(item.get("end").and_then(|value| value.as_f64()).unwrap_or(0.0)),
                text,
            )
            .with_words(words),
        );
    }
    if segments.is_empty() {
        if let Some(text) = value
            .pointer("/results/channels/0/alternatives/0/transcript")
            .and_then(|item| item.as_str())
        {
            if !text.trim().is_empty() {
                segments.push(TranscriptSegment::new(0, 0, text.trim().to_string()));
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
            let mut current_words = Vec::new();
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
                if !token.trim().is_empty() {
                    current_words.push(TranscriptWord {
                        start_ms: word_start,
                        end_ms: word_end,
                        text: token.trim().to_string(),
                    });
                }
                end_ms = word_end;
                if token.ends_with('.') || token.ends_with('?') || token.ends_with('!') {
                    segments.push(
                        TranscriptSegment::new(start_ms, end_ms, current.trim().to_string()).with_words(current_words),
                    );
                    current.clear();
                    current_words = Vec::new();
                }
            }
            if !current.trim().is_empty() {
                segments.push(
                    TranscriptSegment::new(start_ms, end_ms, current.trim().to_string()).with_words(current_words),
                );
            }
        }
        if segments.is_empty() {
            if let Some(text) = body.get("text").and_then(|item| item.as_str()) {
                if !text.trim().is_empty() {
                    segments.push(TranscriptSegment::new(0, 0, text.trim().to_string()));
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
