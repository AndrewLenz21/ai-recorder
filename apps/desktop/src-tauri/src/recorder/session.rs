use serde::{Deserialize, Serialize};

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

