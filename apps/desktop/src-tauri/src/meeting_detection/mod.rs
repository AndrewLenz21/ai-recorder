use serde::Serialize;
use sysinfo::{ProcessExt, System, SystemExt};
use xcap::Window;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedApp {
    pub id: String,
    pub name: String,
    pub running: bool,
    pub focused: bool,
    pub reliability: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusedApp {
    pub name: String,
    pub title: Option<String>,
    pub reliability: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InferredCall {
    pub app_id: String,
    pub reason: String,
    pub reliability: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeetingSnapshot {
    pub running_apps: Vec<DetectedApp>,
    pub focused_app: Option<FocusedApp>,
    pub inferred_active_call: Option<InferredCall>,
    pub notes: Vec<CapabilityNote>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityNote {
    pub level: &'static str,
    pub text: String,
}

struct CatalogEntry {
    id: &'static str,
    name: &'static str,
    matchers: &'static [&'static str],
}

const CATALOG: &[CatalogEntry] = &[
    CatalogEntry {
        id: "microsoft-teams",
        name: "Microsoft Teams",
        matchers: &["ms-teams", "msteams", "teams"],
    },
    CatalogEntry {
        id: "zoom",
        name: "Zoom",
        matchers: &["zoom"],
    },
    CatalogEntry {
        id: "slack",
        name: "Slack",
        matchers: &["slack"],
    },
    CatalogEntry {
        id: "discord",
        name: "Discord",
        matchers: &["discord"],
    },
    CatalogEntry {
        id: "google-meet",
        name: "Google Meet",
        matchers: &[],
    },
];

pub fn snapshot() -> MeetingSnapshot {
    let process_names = running_process_names();
    let focused = focused_window();

    let running_apps = CATALOG
        .iter()
        .filter(|entry| !entry.matchers.is_empty())
        .map(|entry| {
            let running = process_names.iter().any(|name| matches_app(name, entry));
            let focused_match = focused
                .as_ref()
                .map_or(false, |app| matches_app(&app.name.to_lowercase(), entry));
            DetectedApp {
                id: entry.id.to_string(),
                name: entry.name.to_string(),
                running,
                focused: focused_match,
                reliability: "reliable",
            }
        })
        .filter(|app| app.running || app.focused)
        .collect::<Vec<_>>();

    let inferred_active_call = infer_call(&running_apps, focused.as_ref());

    MeetingSnapshot {
        running_apps,
        focused_app: focused,
        inferred_active_call,
        notes: capability_notes(),
    }
}

fn running_process_names() -> Vec<String> {
    let mut system = System::new_all();
    system.refresh_processes();
    system
        .processes()
        .values()
        .map(|process| process.name().to_lowercase())
        .collect()
}

fn focused_window() -> Option<FocusedApp> {
    let windows = Window::all().ok()?;
    windows.into_iter().find_map(|window| {
        if !window.is_focused().unwrap_or(false) {
            return None;
        }
        let name = window.app_name().ok().filter(|value| !value.is_empty())?;
        let title = window.title().ok().filter(|value| !value.is_empty());
        Some(FocusedApp {
            name,
            title,
            reliability: "reliable",
        })
    })
}

fn matches_app(candidate: &str, entry: &CatalogEntry) -> bool {
    let candidate = candidate.to_lowercase();
    entry.matchers.iter().any(|matcher| {
        if *matcher == "teams" {
            candidate == "teams"
                || candidate == "ms-teams"
                || candidate == "msteams"
                || candidate.contains("microsoft teams")
        } else {
            candidate == *matcher || candidate.contains(matcher)
        }
    })
}

fn infer_call(running_apps: &[DetectedApp], focused: Option<&FocusedApp>) -> Option<InferredCall> {
    let title = focused?.title.as_deref()?.to_lowercase();
    let keywords = ["meeting", "call", " | microsoft teams"];
    if !keywords.iter().any(|keyword| title.contains(keyword)) {
        return None;
    }
    let app = running_apps.iter().find(|app| app.focused)?;
    Some(InferredCall {
        app_id: app.id.clone(),
        reason: "The focused window title looks like a meeting, but this is not a confirmed call state.".to_string(),
        reliability: "inferred",
    })
}

fn capability_notes() -> Vec<CapabilityNote> {
    vec![
        CapabilityNote {
            level: "reliable",
            text: "Whether Microsoft Teams or another catalog app is running can be detected from local processes.".to_string(),
        },
        CapabilityNote {
            level: "reliable",
            text: "The foreground application can usually be detected from window metadata.".to_string(),
        },
        CapabilityNote {
            level: "inferred",
            text: "An active call can only be guessed from window titles, which are often redacted or generic.".to_string(),
        },
        CapabilityNote {
            level: "unavailable",
            text: "True in-meeting state for Teams requires a vendor API or deeper platform work and is not claimed here.".to_string(),
        },
    ]
}
