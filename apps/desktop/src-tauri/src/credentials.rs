use std::fs;
use std::path::PathBuf;

use keyring::Entry;
use serde::Deserialize;

use crate::error::AppError;

#[cfg(target_os = "macos")]
mod macos;

const SERVICE: &str = "com.ai.recorder";

fn account(provider_id: &str) -> String {
    format!("provider:{provider_id}")
}

fn vendor_account(kind: &str) -> String {
    format!("vendor:{kind}")
}

pub fn shared_kind(kind: &str) -> bool {
    kind != "local" && kind != "openai-compatible"
}

fn named_entry(account: &str) -> Result<Entry, AppError> {
    Entry::new(SERVICE, account).map_err(AppError::from)
}

fn save_named(account: &str, api_key: &str) -> Result<(), AppError> {
    let value = api_key.trim();
    if value.is_empty() {
        return Err(AppError::msg("API key is empty."));
    }
    #[cfg(target_os = "macos")]
    {
        return macos::save(account, value);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let item = named_entry(account)?;
        item.set_password(value)?;
        let stored = item.get_password()?;
        if stored != value {
            return Err(AppError::msg("Could not persist the API key in the system keychain."));
        }
        Ok(())
    }
}

fn get_named(account: &str) -> Result<Option<String>, AppError> {
    #[cfg(target_os = "macos")]
    {
        if let Some(value) = macos::get(account)? {
            return Ok(Some(value));
        }
    }
    match named_entry(account)?.get_password() {
        Ok(value) if !value.trim().is_empty() => {
            #[cfg(target_os = "macos")]
            {
                let _ = macos::save(account, &value);
            }
            Ok(Some(value))
        }
        Ok(_) => Ok(None),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.into()),
    }
}

fn delete_named(account: &str) -> Result<(), AppError> {
    #[cfg(target_os = "macos")]
    {
        macos::delete(account)?;
    }
    match named_entry(account)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.into()),
    }
}

fn has_named(account: &str) -> bool {
    #[cfg(target_os = "macos")]
    {
        if macos::exists(account) {
            return true;
        }
    }
    get_named(account)
        .ok()
        .flatten()
        .is_some_and(|value| !value.trim().is_empty())
}

pub fn save_secret(provider_id: &str, kind: &str, api_key: &str) -> Result<(), AppError> {
    if shared_kind(kind) {
        save_named(&vendor_account(kind), api_key)?;
    }
    save_named(&account(provider_id), api_key)
}

pub fn get_secret(provider_id: &str, kind: &str) -> Result<Option<String>, AppError> {
    if shared_kind(kind) {
        if let Some(value) = get_named(&vendor_account(kind))? {
            return Ok(Some(value));
        }
    }
    let legacy = get_named(&account(provider_id))?;
    if let Some(value) = legacy.as_deref() {
        if shared_kind(kind) {
            let _ = save_named(&vendor_account(kind), value);
        }
    }
    Ok(legacy)
}

pub fn get_vendor_secret(kind: &str) -> Result<Option<String>, AppError> {
    if !shared_kind(kind) {
        return Ok(None);
    }
    get_named(&vendor_account(kind))
}

pub fn resolve_key(kind: &str, api_key: &str) -> Result<String, AppError> {
    let trimmed = api_key.trim();
    if !trimmed.is_empty() {
        return Ok(trimmed.to_string());
    }
    get_vendor_secret(kind)?.ok_or_else(|| AppError::msg("Add an API key to test this provider."))
}

pub fn has_secret(provider_id: &str, kind: &str) -> bool {
    if shared_kind(kind) && has_named(&vendor_account(kind)) {
        return true;
    }
    has_named(&account(provider_id))
}

pub fn delete_secret(provider_id: &str, kind: &str, keep_vendor: bool) -> Result<(), AppError> {
    delete_named(&account(provider_id))?;
    if shared_kind(kind) && !keep_vendor {
        delete_named(&vendor_account(kind))?;
    }
    Ok(())
}

pub fn save_provider_secret(provider_id: &str, api_key: &str) -> Result<(), AppError> {
    save_named(&account(provider_id), api_key)
}

pub fn delete_provider_secret(provider_id: &str) -> Result<(), AppError> {
    delete_named(&account(provider_id))
}

pub fn has_provider_secret(provider_id: &str) -> bool {
    has_named(&account(provider_id))
}

pub fn key_hint(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    let tail = if trimmed.len() <= 4 {
        trimmed
    } else {
        &trimmed[trimmed.len() - 4..]
    };
    Some(format!("••••••••••••{tail}"))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyFile {
    #[serde(default)]
    entries: Vec<LegacyEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyEntry {
    id: String,
    secret: String,
}

fn legacy_path() -> Option<PathBuf> {
    let root = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).ok()?;
    Some(PathBuf::from(root).join(".ai-recorder").join("secrets.json"))
}

pub fn migrate_legacy_secrets() {
    let Some(path) = legacy_path() else {
        return;
    };
    let Ok(json) = fs::read_to_string(&path) else {
        return;
    };
    let Ok(file) = serde_json::from_str::<LegacyFile>(&json) else {
        return;
    };
    let mut migrated = true;
    for item in file.entries {
        if item.secret.trim().is_empty() {
            continue;
        }
        if save_provider_secret(&item.id, &item.secret).is_err() {
            migrated = false;
        }
    }
    if migrated {
        let _ = fs::remove_file(path);
    }
}
