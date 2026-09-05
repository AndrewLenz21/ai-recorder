use crate::recorder::RecorderEngine;

pub struct AppState {
    pub recorder: RecorderEngine,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            recorder: RecorderEngine::new(),
        }
    }
}
