use crate::meeting_detection::{self, MeetingSnapshot};

#[tauri::command]
pub fn meeting_detection_snapshot() -> MeetingSnapshot {
    meeting_detection::snapshot()
}
