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
    #[serde(default)]
    pub audio_tracks: Vec<AudioTrack>,
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
    pub transcript_source: Option<TranscriptSource>,
    #[serde(default)]
    pub transcript_history: Vec<TranscriptRun>,
    #[serde(default)]
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AudioTrackKind {
    Microphone,
    System,
    Mixed,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TranscriptSource {
    Mixed,
    Microphone,
    System,
    Both,
}

impl TranscriptSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Mixed => "mixed",
            Self::Microphone => "microphone",
            Self::System => "system",
            Self::Both => "both",
        }
    }

    pub fn parse(value: Option<&str>) -> Self {
        match value.map(str::trim).unwrap_or("mixed") {
            "microphone" => Self::Microphone,
            "system" => Self::System,
            "both" | "conversation" => Self::Both,
            _ => Self::Mixed,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioTrack {
    pub id: String,
    pub kind: AudioTrackKind,
    pub path: String,
    pub duration_ms: u64,
    #[serde(default)]
    pub sample_rate: Option<u32>,
    #[serde(default)]
    pub channels: Option<u16>,
    #[serde(default)]
    pub offset_ms: i64,
}

impl RecordingSession {
    pub fn track(&self, kind: AudioTrackKind) -> Option<&AudioTrack> {
        self.audio_tracks.iter().find(|track| track.kind == kind)
    }

    pub fn default_transcript_source(&self) -> TranscriptSource {
        let has_mic = self.track(AudioTrackKind::Microphone).is_some() || self.audio_file.is_some();
        let has_system = self.track(AudioTrackKind::System).is_some();
        if has_mic && has_system {
            TranscriptSource::Both
        } else if has_mic {
            TranscriptSource::Microphone
        } else {
            TranscriptSource::Mixed
        }
    }
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
    #[serde(default)]
    pub source: Option<TranscriptSource>,
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
pub struct TranscriptWord {
    pub start_ms: u64,
    pub end_ms: u64,
    pub text: String,
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
    #[serde(default)]
    pub words: Vec<TranscriptWord>,
    #[serde(default)]
    pub source: Option<TranscriptSource>,
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
            words: Vec::new(),
            source: None,
        }
    }

    pub fn with_words(mut self, words: Vec<TranscriptWord>) -> Self {
        self.words = words;
        self
    }

    pub fn with_source(mut self, source: TranscriptSource) -> Self {
        self.source = Some(source);
        self
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
