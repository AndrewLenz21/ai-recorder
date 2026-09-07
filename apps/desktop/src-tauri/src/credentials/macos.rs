use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use security_framework::passwords::{delete_generic_password, get_generic_password, set_generic_password};
use security_framework_sys::base::errSecItemNotFound;

use crate::error::AppError;

const SERVICE: &str = "com.ai.recorder";

static CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

fn cache() -> &'static Mutex<HashMap<String, String>> {
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn cache_get(account: &str) -> Option<String> {
    cache().lock().ok()?.get(account).cloned()
}

fn cache_put(account: &str, value: &str) {
    if let Ok(mut cache) = cache().lock() {
        cache.insert(account.to_string(), value.to_string());
    }
}

fn cache_remove(account: &str) {
    if let Ok(mut cache) = cache().lock() {
        cache.remove(account);
    }
}

pub fn save(account: &str, value: &str) -> Result<(), AppError> {
    let _ = delete(account);
    set_generic_password(SERVICE, account, value.as_bytes()).map_err(|error| {
        AppError::msg(format!("Could not save the API key in the system keychain. {error}"))
    })?;
    cache_put(account, value);
    Ok(())
}

pub fn get(account: &str) -> Result<Option<String>, AppError> {
    if let Some(hit) = cache_get(account) {
        return Ok(Some(hit));
    }
    match get_generic_password(SERVICE, account) {
        Ok(bytes) => {
            let value = String::from_utf8(bytes)
                .map_err(|_| AppError::msg("Could not read the API key from the system keychain."))?;
            if value.trim().is_empty() {
                return Ok(None);
            }
            cache_put(account, &value);
            Ok(Some(value))
        }
        Err(error) if error.code() == errSecItemNotFound => Ok(None),
        Err(error) => Err(AppError::msg(error.to_string())),
    }
}

pub fn exists(account: &str) -> bool {
    get(account)
        .ok()
        .flatten()
        .is_some_and(|value| !value.trim().is_empty())
}

pub fn delete(account: &str) -> Result<(), AppError> {
    cache_remove(account);
    match delete_generic_password(SERVICE, account) {
        Ok(()) => Ok(()),
        Err(error) if error.code() == errSecItemNotFound => Ok(()),
        Err(error) => Err(AppError::msg(error.to_string())),
    }
}
