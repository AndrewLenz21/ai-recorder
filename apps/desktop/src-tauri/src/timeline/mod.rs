use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum RecordingEvent {
    #[serde(rename = "recordingStarted", rename_all = "camelCase")]
    RecordingStarted {
        id: String,
        recording_id: String,
        timestamp_ms: u64,
        absolute_timestamp: String,
    },
    #[serde(rename = "recordingPaused", rename_all = "camelCase")]
    RecordingPaused {
        id: String,
        recording_id: String,
        timestamp_ms: u64,
        absolute_timestamp: String,
    },
    #[serde(rename = "recordingResumed", rename_all = "camelCase")]
    RecordingResumed {
        id: String,
        recording_id: String,
        timestamp_ms: u64,
        absolute_timestamp: String,
    },
    #[serde(rename = "recordingStopped", rename_all = "camelCase")]
    RecordingStopped {
        id: String,
        recording_id: String,
        timestamp_ms: u64,
        absolute_timestamp: String,
    },
    #[serde(rename = "screenCapture", rename_all = "camelCase")]
    ScreenCapture {
        id: String,
        recording_id: String,
        timestamp_ms: u64,
        absolute_timestamp: String,
        image_path: String,
        file_name: String,
    },
}

pub fn event_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub fn now_rfc3339() -> String {
    chrono::Utc::now().to_rfc3339()
}
