use tauri::{AppHandle, Manager, WebviewWindow, WebviewWindowBuilder};

use crate::error::AppError;

pub fn create_widget(app: &AppHandle) -> Result<(), AppError> {
    if app.get_webview_window("widget").is_some() {
        return Ok(());
    }

    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == "widget")
        .cloned()
        .ok_or_else(|| AppError::msg("Widget window is not configured."))?;

    WebviewWindowBuilder::from_config(app, &config)?.build()?;
    Ok(())
}

pub fn show_widget(app: &AppHandle) -> Result<(), AppError> {
    if app.get_webview_window("widget").is_none() {
        create_widget(app)?;
    }
    if let Some(window) = app.get_webview_window("widget") {
        position_widget(&window)?;
        window.show()?;
    }
    Ok(())
}

pub fn hide_widget(app: &AppHandle) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("widget") {
        window.hide()?;
    }
    Ok(())
}

pub fn show_main(app: &AppHandle) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("main") {
        window.unminimize()?;
        window.show()?;
        window.set_focus()?;
    }
    Ok(())
}

fn position_widget(window: &WebviewWindow) -> Result<(), AppError> {
    let Some(monitor) = window.current_monitor()? else {
        return Ok(());
    };
    let screen = monitor.size();
    let origin = monitor.position();
    let scale = monitor.scale_factor();
    let widget = window.outer_size()?;
    let margin = (18.0 * scale) as i32;
    let x = origin.x + screen.width as i32 - widget.width as i32 - margin;
    let y = origin.y + margin + (28.0 * scale) as i32;
    window.set_position(tauri::PhysicalPosition::new(x, y))?;
    Ok(())
}
