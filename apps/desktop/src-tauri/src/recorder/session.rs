use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::timeline::RecordingEvent;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RecordingStatus {
    Idle,
    Recording,
    Paused,
    Stopping,
    Completed,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingSession {
    pub id: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub folder_id: Option<String>,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_ms: u64,
    pub audio_file: Option<String>,
    pub sample_rate: u32,
    pub channels: u16,
    pub directory: String,
    pub events: Vec<RecordingEvent>,
    #[serde(default)]
    pub transcript: Option<Vec<TranscriptSegment>>,
    #[serde(default)]
    pub transcript_provider: Option<String>,
    #[serde(default)]
    pub transcript_model: Option<String>,
    #[serde(default)]
    pub transcript_language: Option<String>,
    #[serde(default)]
    pub transcript_history: Vec<TranscriptRun>,
    #[serde(default)]
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptRun {
    pub id: String,
    pub created_at: String,
    pub provider: String,
    pub model: String,
    #[serde(default)]
    pub language: Option<String>,
    pub segments: Vec<TranscriptSegment>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TranscriptKind {
    Speech,
    Music,
    Sound,
}

impl Default for TranscriptKind {
    fn default() -> Self {
        Self::Speech
    }
}

impl TranscriptKind {
    pub fn from_text(text: &str) -> Self {
        let trimmed = text.trim();
        let inner = trimmed
            .trim_matches(|mark| mark == '[' || mark == ']' || mark == '(' || mark == ')' || mark == '*' || mark == '♪' || mark == '♫')
            .trim()
            .to_ascii_lowercase();
        if inner.is_empty()
            || inner == "music"
            || inner == "singing"
            || trimmed == "♪"
            || trimmed == "♫"
        {
            return Self::Music;
        }
        if matches!(
            inner.as_str(),
            "applause" | "laughter" | "laughing" | "silence" | "blank_audio" | "inaudible" | "noise" | "cough"
        ) {
            return Self::Sound;
        }
        if (trimmed.starts_with('[') && trimmed.ends_with(']')) || (trimmed.starts_with('(') && trimmed.ends_with(')'))
        {
            return Self::Sound;
        }
        Self::Speech
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptSegment {
    pub id: String,
    pub start_ms: u64,
    pub end_ms: u64,
    pub text: String,
    #[serde(default)]
    pub kind: TranscriptKind,
}

impl TranscriptSegment {
    pub fn new(start_ms: u64, end_ms: u64, text: impl Into<String>) -> Self {
        let text = text.into();
        let kind = TranscriptKind::from_text(&text);
        Self {
            id: Uuid::new_v4().to_string(),
            start_ms,
            end_ms,
            text,
            kind,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub folder_id: Option<String>,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_ms: u64,
    pub screenshot_count: usize,
    pub file_size_bytes: u64,
    pub audio_file: Option<String>,
}

impl SessionSummary {
    pub fn from_session(session: &RecordingSession, file_size_bytes: u64) -> Self {
        Self {
            id: session.id.clone(),
            title: session.title.clone(),
            folder_id: session.folder_id.clone(),
            started_at: session.started_at.clone(),
            ended_at: session.ended_at.clone(),
            duration_ms: session.duration_ms,
            screenshot_count: session
                .events
                .iter()
                .filter(|event| matches!(event, RecordingEvent::ScreenCapture { .. }))
                .count(),
            file_size_bytes,
            audio_file: session.audio_file.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecorderStateDto {
    pub status: RecordingStatus,
    pub session: Option<RecordingSession>,
    pub duration_ms: u64,
    pub error: Option<String>,
}
