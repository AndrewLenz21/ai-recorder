use std::collections::HashMap;
use std::sync::{mpsc, Mutex, OnceLock};

use block2::RcBlock;
use objc2::runtime::{AnyObject, Bool};
use objc2::{class, msg_send};
use objc2_foundation::NSString;
use security_framework::access_control::{ProtectionMode, SecAccessControl};
use security_framework::passwords::{
    delete_generic_password, generic_password, set_generic_password_options, AccessControlOptions,
    PasswordOptions,
};
use security_framework_sys::base::errSecItemNotFound;
use security_framework_sys::item::{
    kSecAttrAccount, kSecAttrService, kSecClass, kSecClassGenericPassword, kSecReturnAttributes,
    kSecUseDataProtectionKeychain,
};
use security_framework_sys::keychain_item::SecItemCopyMatching;
use core_foundation::base::{CFRelease, CFTypeRef, TCFType};
use core_foundation::boolean::CFBoolean;
use core_foundation::dictionary::CFDictionary;
use core_foundation::string::CFString;

use crate::error::AppError;

const SERVICE: &str = "com.ai.recorder";

static CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

fn cache() -> &'static Mutex<HashMap<String, String>> {
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

#[link(name = "LocalAuthentication", kind = "framework")]
extern "C" {}

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

fn owner_auth_available() -> bool {
    unsafe {
        let ctx: *mut AnyObject = msg_send![class!(LAContext), new];
        if ctx.is_null() {
            return false;
        }
        let mut error: *mut AnyObject = std::ptr::null_mut();
        let can: Bool = msg_send![ctx, canEvaluatePolicy: 2i64, error: &mut error];
        let _: () = msg_send![ctx, release];
        can.as_bool()
    }
}

fn confirm_owner(reason: &str) -> Result<(), AppError> {
    if !owner_auth_available() {
        return Ok(());
    }
    let (tx, rx) = mpsc::channel();
    let ctx: *mut AnyObject;
    let block;
    unsafe {
        ctx = msg_send![class!(LAContext), new];
        if ctx.is_null() {
            return Ok(());
        }
        let reason = NSString::from_str(reason);
        block = RcBlock::new(move |success: Bool, _error: *mut AnyObject| {
            let _ = tx.send(success.as_bool());
        });
        let _: () = msg_send![
            ctx,
            evaluatePolicy: 2i64,
            localizedReason: &*reason,
            reply: &*block
        ];
    }
    let result = match rx.recv() {
        Ok(true) => Ok(()),
        Ok(false) => Err(AppError::msg("Authentication was cancelled.")),
        Err(_) => Err(AppError::msg("Could not complete device authentication.")),
    };
    unsafe {
        let _: () = msg_send![ctx, release];
    }
    drop(block);
    result
}

fn access_control(with_presence: bool) -> Result<SecAccessControl, AppError> {
    let flags = if with_presence {
        AccessControlOptions::USER_PRESENCE.bits()
    } else {
        0
    };
    SecAccessControl::create_with_protection(
        Some(ProtectionMode::AccessibleAfterFirstUnlockThisDeviceOnly),
        flags,
    )
    .map_err(|error| AppError::msg(error.to_string()))
}

fn password_options(account: &str, with_presence: bool) -> Result<PasswordOptions, AppError> {
    let mut options = PasswordOptions::new_generic_password(SERVICE, account);
    options.use_protected_keychain();
    options.set_label("AI Recorder");
    options.set_access_control(access_control(with_presence)?);
    Ok(options)
}

pub fn save(account: &str, value: &str) -> Result<(), AppError> {
    let with_presence = owner_auth_available();
    if with_presence {
        confirm_owner("Authenticate to save this API key in Keychain.")?;
    }
    let _ = delete(account);
    let options = password_options(account, with_presence)?;
    set_generic_password_options(value.as_bytes(), options).map_err(|error| {
        AppError::msg(format!("Could not save the API key in the system keychain. {error}"))
    })?;
    cache_put(account, value);
    Ok(())
}

pub fn get(account: &str) -> Result<Option<String>, AppError> {
    if let Some(hit) = cache_get(account) {
        return Ok(Some(hit));
    }
    let mut options = PasswordOptions::new_generic_password(SERVICE, account);
    options.use_protected_keychain();
    match generic_password(options) {
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
    if cache_get(account).is_some() {
        return true;
    }
    unsafe {
        let pairs = [
            (
                CFString::wrap_under_get_rule(kSecClass),
                CFString::wrap_under_get_rule(kSecClassGenericPassword).into_CFType(),
            ),
            (
                CFString::wrap_under_get_rule(kSecAttrService),
                CFString::from(SERVICE).into_CFType(),
            ),
            (
                CFString::wrap_under_get_rule(kSecAttrAccount),
                CFString::from(account).into_CFType(),
            ),
            (
                CFString::wrap_under_get_rule(kSecUseDataProtectionKeychain),
                CFBoolean::from(true).into_CFType(),
            ),
            (
                CFString::wrap_under_get_rule(kSecReturnAttributes),
                CFBoolean::from(true).into_CFType(),
            ),
        ];
        let params = CFDictionary::from_CFType_pairs(&pairs);
        let mut result: CFTypeRef = std::ptr::null();
        let status = SecItemCopyMatching(params.as_concrete_TypeRef(), &mut result);
        if !result.is_null() {
            CFRelease(result);
        }
        status == 0
    }
}

pub fn delete(account: &str) -> Result<(), AppError> {
    cache_remove(account);
    match delete_generic_password(SERVICE, account) {
        Ok(()) => Ok(()),
        Err(error) if error.code() == errSecItemNotFound => Ok(()),
        Err(error) => Err(AppError::msg(error.to_string())),
    }
}
