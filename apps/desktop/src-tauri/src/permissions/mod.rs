use cpal::traits::{DeviceTrait, HostTrait};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PermissionState {
    Granted,
    Denied,
    NotDetermined,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionsStatus {
    pub microphone: PermissionState,
    pub screen_recording: PermissionState,
}

pub fn status() -> PermissionsStatus {
    PermissionsStatus {
        microphone: microphone_status(),
        screen_recording: screen_status(),
    }
}

pub fn request(kind: &str) -> Result<PermissionsStatus, AppError> {
    match kind {
        "microphone" => request_microphone(),
        "screen" => request_screen(),
        _ => return Err(AppError::msg("Unknown permission.")),
    }
    Ok(status())
}

pub fn open_settings(app: &AppHandle, kind: &str) -> Result<(), AppError> {
    let url = settings_url(kind)?;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|error| AppError::msg(error.to_string()))?;
    Ok(())
}

fn settings_url(kind: &str) -> Result<&'static str, AppError> {
    #[cfg(target_os = "macos")]
    {
        return Ok(match kind {
            "microphone" => {
                "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
            }
            "screen" => {
                "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
            }
            _ => return Err(AppError::msg("Unknown permission.")),
        });
    }

    #[cfg(target_os = "windows")]
    {
        return Ok(match kind {
            "microphone" => "ms-settings:privacy-microphone",
            "screen" => "ms-settings:privacy-webcam",
            _ => return Err(AppError::msg("Unknown permission.")),
        });
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = kind;
        Err(AppError::msg(
            "Open your system privacy settings to grant this permission.",
        ))
    }
}

fn microphone_status() -> PermissionState {
    let host = cpal::default_host();
    match host.default_input_device() {
        Some(_) => PermissionState::Unknown,
        None => PermissionState::Denied,
    }
}

fn request_microphone() {
    let host = cpal::default_host();
    if let Some(device) = host.default_input_device() {
        let _ = device.default_input_config();
    }
}

fn screen_status() -> PermissionState {
    #[cfg(target_os = "macos")]
    {
        if unsafe { sys::CGPreflightScreenCaptureAccess() } {
            PermissionState::Granted
        } else {
            PermissionState::NotDetermined
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        PermissionState::Unknown
    }
}

fn request_screen() {
    #[cfg(target_os = "macos")]
    unsafe {
        let _ = sys::CGRequestScreenCaptureAccess();
    }
}

#[cfg(target_os = "macos")]
mod sys {
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        pub fn CGPreflightScreenCaptureAccess() -> bool;
        pub fn CGRequestScreenCaptureAccess() -> bool;
    }
}
