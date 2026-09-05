use std::path::Path;

use xcap::Monitor;

use crate::error::AppError;

pub fn capture_primary_to_file(path: &Path) -> Result<(), AppError> {
    let monitors = Monitor::all().map_err(|error| {
        AppError::msg(format!(
            "Screen capture is unavailable. Grant Screen Recording permission in System Settings. {error}"
        ))
    })?;

    let monitor = monitors
        .into_iter()
        .find(|monitor| monitor.is_primary().unwrap_or(false))
        .or_else(|| Monitor::all().ok().and_then(|mut list| list.pop()))
        .ok_or_else(|| AppError::msg("No display was found to capture."))?;

    let image = monitor.capture_image().map_err(|error| {
        AppError::msg(format!(
            "Could not capture the screen. Check Screen Recording permission. {error}"
        ))
    })?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    image
        .save(path)
        .map_err(|error| AppError::msg(format!("Could not save the screenshot. {error}")))?;
    Ok(())
}
