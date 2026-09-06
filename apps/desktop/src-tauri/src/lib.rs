mod ai;
mod commands;
mod credentials;
mod error;
mod library;
mod meeting_detection;
mod permissions;
mod recorder;
mod screen_capture;
mod settings;
mod state;
mod storage;
mod timeline;
mod transcription;
mod windows;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .setup(|app| {
            credentials::migrate_legacy_secrets();
            if let Err(error) = windows::create_widget(app.handle()) {
                eprintln!("widget window was not created: {error}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::recorder::recorder_start,
            commands::recorder::recorder_set_destination,
            commands::recorder::recorder_pause,
            commands::recorder::recorder_resume,
            commands::recorder::recorder_stop,
            commands::recorder::recorder_dismiss,
            commands::recorder::recorder_state,
            commands::recorder::recorder_list_sessions,
            commands::recorder::recorder_get_session,
            commands::library::library_get,
            commands::library::library_storage_stats,
            commands::library::library_create_folder,
            commands::library::library_update_folder,
            commands::library::library_delete_folder,
            commands::library::library_set_default_folder,
            commands::library::recorder_rename_session,
            commands::library::recorder_move_session,
            commands::library::recorder_delete_session,
            commands::screen_capture::screen_capture_take,
            commands::permissions::permissions_status,
            commands::permissions::permissions_request,
            commands::permissions::permissions_open_settings,
            commands::meeting_detection::meeting_detection_snapshot,
            commands::windows::window_show_main,
            commands::windows::window_show_widget,
            commands::windows::window_hide_widget,
            commands::settings::settings_get,
            commands::settings::settings_connect_provider,
            commands::settings::settings_update_connection,
            commands::settings::settings_disconnect_provider,
            commands::settings::settings_set_default_provider,
            commands::settings::settings_test_connection,
            commands::settings::settings_test_credentials,
            commands::settings::settings_preview_ai_models,
            commands::settings::settings_refresh_ai_models,
            commands::settings::settings_preview_transcription_models,
            commands::settings::settings_refresh_transcription_models,
            commands::settings::settings_download_local_model,
            commands::settings::settings_remove_local_model,
            commands::settings::recorder_transcribe,
            commands::settings::recorder_generate_summary,
            commands::settings::credentials_has,
            commands::settings::credentials_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
