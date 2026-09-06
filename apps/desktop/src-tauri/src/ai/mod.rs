use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::error::AppError;
use crate::recorder::session::TranscriptSegment;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiModel {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Option<Vec<ChatChoice>>,
    error: Option<ChatError>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: Option<ChatMessage>,
}

#[derive(Debug, Deserialize)]
struct ChatMessage {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChatError {
    message: Option<String>,
}

fn openai_base(kind: &str, base_url: Option<&str>) -> Result<String, AppError> {
    match kind {
        "novita" => Ok("https://api.novita.ai/v3/openai".to_string()),
        "openai" => Ok("https://api.openai.com/v1".to_string()),
        "groq" => Ok("https://api.groq.com/openai/v1".to_string()),
        "xai" => Ok("https://api.x.ai/v1".to_string()),
        "openrouter" => Ok("https://openrouter.ai/api/v1".to_string()),
        "openai-compatible" => {
            let base = base_url
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| AppError::msg("Add a base URL for this provider."))?;
            Ok(base.trim_end_matches('/').to_string())
        }
        _ => Err(AppError::msg("Unsupported AI provider.")),
    }
}

fn models_url(kind: &str, base_url: Option<&str>) -> Result<String, AppError> {
    match kind {
        "anthropic" => Ok("https://api.anthropic.com/v1/models".to_string()),
        "gemini" => Ok("https://generativelanguage.googleapis.com/v1beta/models".to_string()),
        _ => Ok(format!("{}/models", openai_base(kind, base_url)?)),
    }
}

fn parse_listed_model(kind: &str, item: serde_json::Value) -> Option<AiModel> {
    if kind == "gemini" {
        let methods = item
            .get("supportedGenerationMethods")
            .and_then(|value| value.as_array());
        if let Some(methods) = methods {
            let can_generate = methods.iter().any(|value| value.as_str() == Some("generateContent"));
            if !can_generate {
                return None;
            }
        }
        let raw = item.get("name").and_then(|value| value.as_str())?;
        let id = raw.trim_start_matches("models/").to_string();
        if id.is_empty() {
            return None;
        }
        let name = item
            .get("displayName")
            .and_then(|value| value.as_str())
            .map(|value| value.to_string())
            .unwrap_or_else(|| model_name(&id));
        return Some(AiModel { id, name });
    }
    let id = item.get("id").and_then(|value| value.as_str())?.to_string();
    if id.trim().is_empty() {
        return None;
    }
    if kind == "openai" && !id.starts_with("gpt-") {
        return None;
    }
    if kind == "groq" && id.contains("whisper") {
        return None;
    }
    if kind == "xai" && !id.to_lowercase().contains("grok") && !id.contains("grok") {
        // keep grok models; if naming differs still include chat-like ids
        if id.contains("embedding") {
            return None;
        }
    }
    let name = item
        .get("display_name")
        .or_else(|| item.get("displayName"))
        .or_else(|| item.get("name"))
        .and_then(|value| value.as_str())
        .map(|value| value.to_string())
        .unwrap_or_else(|| model_name(&id));
    Some(AiModel { id, name })
}

fn model_name(id: &str) -> String {
    id.rsplit('/')
        .next()
        .unwrap_or(id)
        .replace('-', " ")
        .replace('_', " ")
}

fn chat_url(kind: &str, base_url: Option<&str>) -> Result<String, AppError> {
    Ok(format!("{}/chat/completions", openai_base(kind, base_url)?))
}

fn resolve_model(model: &str, custom_model: Option<&str>) -> String {
    let custom = custom_model.unwrap_or("").trim();
    if !custom.is_empty() {
        return custom.to_string();
    }
    let model = model.trim();
    if model.is_empty() {
        "meta-llama/llama-3.1-8b-instruct".to_string()
    } else {
        model.to_string()
    }
}

fn transcript_text(segments: &[TranscriptSegment]) -> String {
    segments
        .iter()
        .map(|segment| segment.text.trim())
        .filter(|text| !text.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

fn apply_auth(request: reqwest::RequestBuilder, kind: &str, api_key: &str) -> reqwest::RequestBuilder {
    match kind {
        "anthropic" => request
            .header("x-api-key", api_key.trim())
            .header("anthropic-version", "2023-06-01"),
        "gemini" => request,
        "openrouter" => request
            .bearer_auth(api_key.trim())
            .header("HTTP-Referer", "https://ai-recorder.app")
            .header("X-Title", "AI Recorder"),
        _ => request.bearer_auth(api_key.trim()),
    }
}

async fn chat(
    kind: &str,
    base_url: Option<&str>,
    api_key: &str,
    model: &str,
    system: &str,
    user: &str,
) -> Result<String, AppError> {
    if api_key.trim().is_empty() {
        return Err(AppError::msg("Add an AI API key in Settings."));
    }
    match kind {
        "anthropic" => anthropic_chat(api_key, model, system, user).await,
        "gemini" => gemini_chat(api_key, model, system, user).await,
        _ => openai_chat(kind, base_url, api_key, model, system, user).await,
    }
}

async fn openai_chat(
    kind: &str,
    base_url: Option<&str>,
    api_key: &str,
    model: &str,
    system: &str,
    user: &str,
) -> Result<String, AppError> {
    let payload = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user }
        ],
        "max_tokens": 900,
        "temperature": 0.3
    });
    let response = apply_auth(
        reqwest::Client::new().post(chat_url(kind, base_url)?),
        kind,
        api_key,
    )
    .json(&payload)
    .send()
    .await?;
    let status = response.status();
    let body = response.text().await?;
    let parsed: ChatResponse = serde_json::from_str(&body).unwrap_or(ChatResponse {
        choices: None,
        error: None,
    });
    if let Some(message) = parsed.error.and_then(|error| error.message) {
        return Err(AppError::msg(message));
    }
    if !status.is_success() {
        return Err(AppError::msg(format!("AI request failed ({status}).")));
    }
    parsed
        .choices
        .and_then(|choices| choices.into_iter().next())
        .and_then(|choice| choice.message)
        .and_then(|message| message.content)
        .map(|content| content.trim().to_string())
        .filter(|content| !content.is_empty())
        .ok_or_else(|| AppError::msg("The AI provider returned an empty response."))
}

async fn anthropic_chat(api_key: &str, model: &str, system: &str, user: &str) -> Result<String, AppError> {
    let payload = json!({
        "model": model,
        "max_tokens": 900,
        "system": system,
        "messages": [{ "role": "user", "content": user }]
    });
    let response = apply_auth(
        reqwest::Client::new().post("https://api.anthropic.com/v1/messages"),
        "anthropic",
        api_key,
    )
    .json(&payload)
    .send()
    .await?;
    let status = response.status();
    let body = response.text().await?;
    if !status.is_success() {
        return Err(AppError::msg(format_provider_error(&body, status.as_u16())));
    }
    let value: serde_json::Value = serde_json::from_str(&body)?;
    value
        .pointer("/content/0/text")
        .and_then(|item| item.as_str())
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
        .ok_or_else(|| AppError::msg("Anthropic returned an empty response."))
}

async fn gemini_chat(api_key: &str, model: &str, system: &str, user: &str) -> Result<String, AppError> {
    let model_id = model.trim_start_matches("models/");
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={}",
        api_key.trim()
    );
    let payload = json!({
        "systemInstruction": { "parts": [{ "text": system }] },
        "contents": [{ "role": "user", "parts": [{ "text": user }] }]
    });
    let response = reqwest::Client::new().post(url).json(&payload).send().await?;
    let status = response.status();
    let body = response.text().await?;
    if !status.is_success() {
        return Err(AppError::msg(format_provider_error(&body, status.as_u16())));
    }
    let value: serde_json::Value = serde_json::from_str(&body)?;
    value
        .pointer("/candidates/0/content/parts/0/text")
        .and_then(|item| item.as_str())
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
        .ok_or_else(|| AppError::msg("Gemini returned an empty response."))
}

fn format_provider_error(body: &str, status: u16) -> String {
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(body) {
        if let Some(message) = value
            .pointer("/error/message")
            .or_else(|| value.pointer("/error/status"))
            .and_then(|item| item.as_str())
        {
            return message.to_string();
        }
    }
    format!("AI request failed ({status}).")
}

pub async fn generate_summary(
    kind: &str,
    base_url: Option<&str>,
    api_key: &str,
    model: &str,
    segments: &[TranscriptSegment],
) -> Result<String, AppError> {
    let transcript = transcript_text(segments);
    if transcript.is_empty() {
        return Err(AppError::msg("Transcribe this recording before generating a summary."));
    }
    chat(
        kind,
        base_url,
        api_key,
        &resolve_model(model, None),
        "You summarize recorded conversations. Write a concise, well-structured summary in plain language. Use short paragraphs. Do not invent details.",
        &format!("Summarize this transcript:\n\n{transcript}"),
    )
    .await
}

pub async fn test_connection(
    kind: &str,
    base_url: Option<&str>,
    api_key: &str,
    model: &str,
) -> Result<(), AppError> {
    if list_models(kind, base_url, api_key).await.is_ok() {
        return Ok(());
    }
    let reply = chat(
        kind,
        base_url,
        api_key,
        &resolve_model(model, None),
        "Reply with the single word OK.",
        "OK",
    )
    .await?;
    if reply.is_empty() {
        return Err(AppError::msg("AI provider did not respond."));
    }
    Ok(())
}

pub async fn list_models(
    kind: &str,
    base_url: Option<&str>,
    api_key: &str,
) -> Result<Vec<AiModel>, AppError> {
    if api_key.trim().is_empty() {
        return Err(AppError::msg("Add an AI API key in Settings."));
    }
    let url = models_url(kind, base_url)?;
    let url = if kind == "gemini" {
        format!("{url}?key={}", api_key.trim())
    } else {
        url
    };
    let response = apply_auth(reqwest::Client::new().get(url), kind, api_key)
        .send()
        .await?;
    let status = response.status();
    let body = response.text().await?;
    if !status.is_success() {
        return Err(AppError::msg("Could not list models for this provider."));
    }
    let value: serde_json::Value =
        serde_json::from_str(&body).map_err(|_| AppError::msg("Could not parse the model list."))?;
    let rows = value
        .get("data")
        .or_else(|| value.get("models"))
        .and_then(|item| item.as_array())
        .cloned()
        .unwrap_or_default();
    let mut models: Vec<AiModel> = rows
        .into_iter()
        .filter_map(|item| parse_listed_model(kind, item))
        .collect();
    models.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    models.dedup_by(|left, right| left.id == right.id);
    if models.is_empty() {
        return Err(AppError::msg("This provider did not return any models."));
    }
    Ok(models)
}
