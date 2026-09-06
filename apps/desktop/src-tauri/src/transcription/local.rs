use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Deserialize;
use uuid::Uuid;

use crate::error::AppError;
use crate::recorder::session::TranscriptSegment;
use crate::settings;

#[derive(Debug, Deserialize)]
struct WhisperCliFile {
    #[serde(default)]
    transcription: Vec<WhisperCliLine>,
}

#[derive(Debug, Deserialize)]
struct WhisperCliLine {
    timestamps: Option<WhisperCliStamps>,
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WhisperCliStamps {
    from: Option<String>,
    to: Option<String>,
}

fn parse_stamp(value: &str) -> u64 {
    let cleaned = value.replace(',', ".");
    let parts: Vec<&str> = cleaned.split(':').collect();
    if parts.len() != 3 {
        return 0;
    }
    let hours: f64 = parts[0].parse().unwrap_or(0.0);
    let minutes: f64 = parts[1].parse().unwrap_or(0.0);
    let seconds: f64 = parts[2].parse().unwrap_or(0.0);
    ((hours * 3600.0 + minutes * 60.0 + seconds) * 1000.0) as u64
}

pub fn runtime_available() -> bool {
    find_cli().is_some()
}

fn find_cli() -> Option<PathBuf> {
    let names = ["whisper-cli", "whisper"];
    if let Ok(path) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path) {
            for name in names {
                let candidate = dir.join(name);
                if candidate.exists() {
                    return Some(candidate);
                }
            }
        }
    }
    None
}

pub fn transcribe(app: &tauri::AppHandle, model_id: &str, audio_path: &Path) -> Result<Vec<TranscriptSegment>, AppError> {
    let model = settings::model_path(app, model_id)?;
    if !model.exists() {
        return Err(AppError::msg(
            "Download this Whisper model in Settings before running local transcription.",
        ));
    }
    let cli = find_cli().ok_or_else(|| {
        AppError::msg(
            "Local Whisper runtime was not found. Install whisper.cpp (`whisper-cli`) on this computer to transcribe offline.",
        )
    })?;
    let output_dir = audio_path.parent().unwrap_or(Path::new("."));
    let stem = audio_path.file_stem().and_then(|value| value.to_str()).unwrap_or("transcript");
    let json_path = output_dir.join(format!("{stem}.json"));
    let status = Command::new(cli)
        .args([
            "-m",
            &model.to_string_lossy(),
            "-f",
            &audio_path.to_string_lossy(),
            "-oj",
            "-of",
            &output_dir.join(stem).to_string_lossy(),
            "-np",
        ])
        .status()
        .map_err(|error| AppError::msg(format!("Could not start whisper-cli: {error}")))?;
    if !status.success() {
        return Err(AppError::msg("Local transcription failed."));
    }
    let json = fs_read_first(&json_path, &output_dir.join(format!("{stem}.json")))?;
    let parsed: WhisperCliFile =
        serde_json::from_str(&json).map_err(|_| AppError::msg("Could not parse local transcription output."))?;
    let segments: Vec<TranscriptSegment> = parsed
        .transcription
        .into_iter()
        .filter_map(|line| {
            let text = line.text.unwrap_or_default().trim().to_string();
            if text.is_empty() {
                return None;
            }
            let start = line
                .timestamps
                .as_ref()
                .and_then(|item| item.from.as_deref())
                .map(parse_stamp)
                .unwrap_or(0);
            let end = line
                .timestamps
                .as_ref()
                .and_then(|item| item.to.as_deref())
                .map(parse_stamp)
                .unwrap_or(start);
            Some(TranscriptSegment {
                id: Uuid::new_v4().to_string(),
                start_ms: start,
                end_ms: end,
                text,
            })
        })
        .collect();
    if segments.is_empty() {
        return Err(AppError::msg("Local transcription returned no text."));
    }
    Ok(segments)
}

fn fs_read_first(primary: &Path, secondary: &Path) -> Result<String, AppError> {
    if primary.exists() {
        return Ok(std::fs::read_to_string(primary)?);
    }
    if secondary.exists() {
        return Ok(std::fs::read_to_string(secondary)?);
    }
    Err(AppError::msg("whisper-cli did not write a transcript file."))
}
