#[cfg(not(target_os = "macos"))]
use std::path::PathBuf;
#[cfg(not(target_os = "macos"))]
use std::sync::atomic::AtomicBool;
#[cfg(not(target_os = "macos"))]
use std::sync::Arc;
#[cfg(not(target_os = "macos"))]
use std::time::Instant;

#[cfg(not(target_os = "macos"))]
use crate::error::AppError;

#[cfg(target_os = "macos")]
mod macos;

#[cfg(target_os = "macos")]
pub use macos::SystemAudioCapture;

#[cfg(not(target_os = "macos"))]
pub struct SystemAudioCapture;

#[cfg(not(target_os = "macos"))]
impl SystemAudioCapture {
    pub fn start(
        _path: PathBuf,
        _writing: Arc<AtomicBool>,
        _origin: Instant,
    ) -> Result<Self, AppError> {
        Err(AppError::msg(
            "System audio capture is only available on macOS.",
        ))
    }

    pub fn duration_ms(&self) -> u64 {
        0
    }

    pub fn sample_rate(&self) -> u32 {
        0
    }

    pub fn channels(&self) -> u16 {
        0
    }

    pub fn stop(self) -> Result<u64, AppError> {
        Ok(0)
    }
}
