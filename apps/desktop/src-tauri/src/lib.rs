mod commands;
mod error;
mod library;
mod meeting_detection;
mod permissions;
mod recorder;
mod screen_capture;
mod state;
mod storage;
mod timeline;
mod windows;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .setup(|app| {
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
