use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{AppHandle, Emitter};

use crate::error::AppError;
use crate::recorder::audio::AudioCapture;
use crate::recorder::session::{RecorderStateDto, RecordingSession, RecordingStatus};
use crate::storage;
use crate::timeline::{event_id, now_rfc3339, RecordingEvent};
use crate::windows;

struct Inner {
    status: RecordingStatus,
    session: Option<RecordingSession>,
    audio: Option<AudioCapture>,
    capture_count: u32,
    error: Option<String>,
}

pub struct RecorderEngine {
    inner: Mutex<Inner>,
}

impl RecorderEngine {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(Inner {
                status: RecordingStatus::Idle,
                session: None,
                audio: None,
                capture_count: 0,
                error: None,
            }),
        }
    }

    pub fn snapshot(&self) -> RecorderStateDto {
        let inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());
        snapshot_from(&inner)
    }

    pub fn start(
        &self,
        app: &AppHandle,
        folder_id: Option<String>,
    ) -> Result<RecorderStateDto, AppError> {
        {
            let inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());
            if matches!(
                inner.status,
                RecordingStatus::Recording | RecordingStatus::Paused | RecordingStatus::Stopping
            ) {
                return Err(AppError::msg("A recording is already in progress."));
            }
        }

        let session_id = uuid::Uuid::new_v4().to_string();
        let root = storage::recordings_dir(app)?;
        let directory = storage::session_dir(&root, &session_id);
        fs::create_dir_all(directory.join("captures"))?;
        let audio_path = directory.join("audio.wav");

        let audio = match AudioCapture::start(audio_path.clone()) {
            Ok(audio) => audio,
            Err(error) => {
                let mut inner = self.inner.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
                inner.status = RecordingStatus::Error;
                inner.error = Some(error.to_string());
                inner.session = None;
                inner.audio = None;
                drop(inner);
                let state = self.snapshot();
                emit_state(app, &state);
                return Err(error);
            }
        };

        let started_at = now_rfc3339();
        let mut session = RecordingSession {
            id: session_id.clone(),
            title: None,
            folder_id: resolve_folder_id(app, folder_id)?,
            started_at: started_at.clone(),
            ended_at: None,
            duration_ms: 0,
            audio_file: Some(path_to_string(&audio_path)),
            sample_rate: audio.sample_rate(),
            channels: audio.channels(),
            directory: path_to_string(&directory),
            events: Vec::new(),
            transcript: None,
            summary: None,
        };
        session.events.push(RecordingEvent::RecordingStarted {
            id: event_id(),
            recording_id: session_id,
            timestamp_ms: 0,
            absolute_timestamp: started_at,
        });
        storage::persist_session(&session)?;

        {
            let mut inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());
            inner.status = RecordingStatus::Recording;
            inner.session = Some(session);
            inner.audio = Some(audio);
            inner.capture_count = 0;
            inner.error = None;
        }

        let _ = windows::show_widget(app);
        let state = self.snapshot();
        emit_state(app, &state);
        Ok(state)
    }

    pub fn set_folder(
        &self,
        app: &AppHandle,
        folder_id: Option<String>,
    ) -> Result<RecorderStateDto, AppError> {
        let folder_id = resolve_folder_id(app, folder_id)?;
        {
            let mut inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());
            let session = inner
                .session
                .as_mut()
                .ok_or_else(|| AppError::msg("No active recording."))?;
            session.folder_id = folder_id;
            storage::persist_session(session)?;
        }
        let state = self.snapshot();
        emit_state(app, &state);
        Ok(state)
    }

    pub fn pause(&self, app: &AppHandle) -> Result<RecorderStateDto, AppError> {
        {
            let mut inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());
            if inner.status != RecordingStatus::Recording {
                return Err(AppError::msg("Recording is not active."));
            }
            if let Some(audio) = inner.audio.as_ref() {
                audio.set_writing(false);
            }
            let timestamp_ms = current_duration_ms(&inner);
            if let Some(session) = inner.session.as_mut() {
                session.duration_ms = timestamp_ms;
                session.events.push(RecordingEvent::RecordingPaused {
                    id: event_id(),
                    recording_id: session.id.clone(),
                    timestamp_ms,
                    absolute_timestamp: now_rfc3339(),
                });
                storage::persist_session(session)?;
            }
            inner.status = RecordingStatus::Paused;
        }
        let state = self.snapshot();
        emit_state(app, &state);
        Ok(state)
    }

    pub fn resume(&self, app: &AppHandle) -> Result<RecorderStateDto, AppError> {
        {
            let mut inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());
            if inner.status != RecordingStatus::Paused {
                return Err(AppError::msg("Recording is not paused."));
            }
            if let Some(audio) = inner.audio.as_ref() {
                audio.set_writing(true);
            }
            let timestamp_ms = current_duration_ms(&inner);
            if let Some(session) = inner.session.as_mut() {
                session.duration_ms = timestamp_ms;
                session.events.push(RecordingEvent::RecordingResumed {
                    id: event_id(),
                    recording_id: session.id.clone(),
                    timestamp_ms,
                    absolute_timestamp: now_rfc3339(),
                });
                storage::persist_session(session)?;
            }
            inner.status = RecordingStatus::Recording;
        }
        let state = self.snapshot();
        emit_state(app, &state);
        Ok(state)
    }

    pub fn stop(&self, app: &AppHandle) -> Result<RecorderStateDto, AppError> {
        let audio = {
            let mut inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());
            if !matches!(
                inner.status,
                RecordingStatus::Recording | RecordingStatus::Paused
            ) {
                return Err(AppError::msg("No active recording to stop."));
            }
            inner.status = RecordingStatus::Stopping;
            inner.audio.take()
        };
        emit_state(app, &self.snapshot());

        let duration_ms = if let Some(audio) = audio {
            audio.stop()?
        } else {
            0
        };

        {
            let mut inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());
            if let Some(session) = inner.session.as_mut() {
                session.duration_ms = duration_ms;
                session.ended_at = Some(now_rfc3339());
                session.events.push(RecordingEvent::RecordingStopped {
                    id: event_id(),
                    recording_id: session.id.clone(),
                    timestamp_ms: duration_ms,
                    absolute_timestamp: session.ended_at.clone().unwrap_or_else(now_rfc3339),
                });
                storage::persist_session(session)?;
            }
            inner.status = RecordingStatus::Completed;
            inner.error = None;
        }

        let _ = windows::hide_widget(app);
        let state = self.snapshot();
        emit_state(app, &state);
        Ok(state)
    }

    pub fn dismiss(&self, app: &AppHandle) -> Result<RecorderStateDto, AppError> {
        {
            let mut inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());
            if matches!(
                inner.status,
                RecordingStatus::Recording | RecordingStatus::Paused | RecordingStatus::Stopping
            ) {
                return Err(AppError::msg("Stop the recording before leaving this view."));
            }
            inner.status = RecordingStatus::Idle;
            inner.session = None;
            inner.audio = None;
            inner.error = None;
            inner.capture_count = 0;
        }
        let state = self.snapshot();
        emit_state(app, &state);
        Ok(state)
    }

    pub fn attach_screen_capture(
        &self,
        app: &AppHandle,
        image_path: PathBuf,
        file_name: String,
    ) -> Result<RecordingEvent, AppError> {
        let event = {
            let mut inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());
            if !matches!(
                inner.status,
                RecordingStatus::Recording | RecordingStatus::Paused
            ) {
                return Err(AppError::msg(
                    "Start a recording before capturing the screen.",
                ));
            }
            let timestamp_ms = current_duration_ms(&inner);
            let recording_id = inner
                .session
                .as_ref()
                .map(|session| session.id.clone())
                .ok_or_else(|| AppError::msg("No active recording."))?;
            let event = RecordingEvent::ScreenCapture {
                id: event_id(),
                recording_id,
                timestamp_ms,
                absolute_timestamp: now_rfc3339(),
                image_path: path_to_string(&image_path),
                file_name,
            };
            if let Some(session) = inner.session.as_mut() {
                session.duration_ms = timestamp_ms;
                session.events.push(event.clone());
                storage::persist_session(session)?;
            }
            event
        };

        let state = self.snapshot();
        emit_state(app, &state);
        let _ = app.emit("timeline:event", &event);
        Ok(event)
    }

    pub fn next_capture_name(&self) -> Result<(PathBuf, String), AppError> {
        let mut inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());
        let directory = inner
            .session
            .as_ref()
            .ok_or_else(|| AppError::msg("Start a recording before capturing the screen."))?
            .directory
            .clone();
        inner.capture_count += 1;
        let file_name = format!("screenshot-{:03}.png", inner.capture_count);
        let path = PathBuf::from(directory)
            .join("captures")
            .join(&file_name);
        Ok((path, file_name))
    }
}

fn snapshot_from(inner: &Inner) -> RecorderStateDto {
    let mut session = inner.session.clone();
    let duration_ms = current_duration_ms(inner);
    if let Some(session) = session.as_mut() {
        session.duration_ms = duration_ms;
    }
    RecorderStateDto {
        status: inner.status,
        session,
        duration_ms,
        error: inner.error.clone(),
    }
}

fn current_duration_ms(inner: &Inner) -> u64 {
    inner
        .audio
        .as_ref()
        .map(AudioCapture::duration_ms)
        .or_else(|| inner.session.as_ref().map(|session| session.duration_ms))
        .unwrap_or(0)
}

fn emit_state(app: &AppHandle, state: &RecorderStateDto) {
    let _ = app.emit("recorder:state", state);
}

fn path_to_string(path: &PathBuf) -> String {
    path.to_string_lossy().to_string()
}

fn resolve_folder_id(app: &AppHandle, folder_id: Option<String>) -> Result<Option<String>, AppError> {
    let Some(folder_id) = folder_id else {
        return Ok(None);
    };
    let library = storage::read_library(app)?;
    if library.folders.iter().any(|folder| folder.id == folder_id) {
        Ok(Some(folder_id))
    } else {
        Ok(None)
    }
}
