import { useState, type ReactNode } from "react";

import { seekAudio } from "@/modules/audio-player";
import { providerModelLabel } from "@/modules/settings/catalog";
import { settingsService } from "@/modules/settings/services/settings.service";
import { CaptureIcon, NotesIcon, SparkleIcon } from "@/shared/components/icons";
import { showToast } from "@/shared/stores/toast.store";
import type { AppSettings, ProviderConnection } from "@/tauri/commands/settings";
import type { RecordingEvent, RecordingSession } from "@/tauri/types";

import { useLibraryStore } from "../stores/library.store";
import { useRecorder } from "@/modules/recorder";

import { ScreenshotsTab } from "./ScreenshotsTab";
import { SummaryTab } from "./SummaryTab";
import { TranscriptTab } from "./TranscriptTab";

type CaptureEvent = Extract<RecordingEvent, { type: "screenCapture" }>;

export type DetailTabId = "screenshots" | "transcript" | "summary";

const TABS: { id: DetailTabId; label: string; icon: ReactNode }[] = [
  { id: "screenshots", label: "Screenshots", icon: <CaptureIcon size={14} /> },
  { id: "transcript", label: "Transcript", icon: <NotesIcon size={14} /> },
  { id: "summary", label: "AI Summary", icon: <SparkleIcon size={14} /> },
];

type Props = {
  session: RecordingSession;
  settings: AppSettings | null;
  captures: CaptureEvent[];
  selectedCaptureId: string | null;
  onSelectCapture: (id: string, timestampMs: number) => void;
  onSessionUpdate: (session: RecordingSession) => void;
  tab: DetailTabId;
  onTabChange: (tab: DetailTabId) => void;
};

function sendToNotion() {
  showToast("error", "Notion export isn’t available yet");
}

function defaultConnection(settings: AppSettings | null, capability: "transcription" | "ai"): ProviderConnection | undefined {
  return (
    settings?.connections.find((item) => item.capability === capability && item.isDefault) ??
    settings?.connections.find((item) => item.capability === capability)
  );
}

export function RecordingDetailTabs({
  session,
  settings,
  captures,
  selectedCaptureId,
  onSelectCapture,
  onSessionUpdate,
  tab,
  onTabChange,
}: Props) {
  const [transcriptStatus, setTranscriptStatus] = useState<"empty" | "ready" | "transcribing" | "error">(
    session.transcript && session.transcript.length > 0 ? "ready" : "empty",
  );
  const [summaryStatus, setSummaryStatus] = useState<"idle" | "loading" | "ready" | "error">(
    session.summary ? "ready" : "idle",
  );
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const transcription = defaultConnection(settings, "transcription");
  const ai = defaultConnection(settings, "ai");
  const transcriptionConfigured = Boolean(
    transcription && (transcription.type === "local" || transcription.hasCredential),
  );
  const aiConfigured = Boolean(ai?.hasCredential);
  const providerLabel = transcription
    ? `${transcription.displayName} · ${providerModelLabel("transcription", transcription.type, transcription.model)}`
    : null;

  const { dismiss } = useRecorder();
  const openSettings = (section: "transcription" | "ai") => {
    try {
      window.sessionStorage.setItem("ai-recorder.settings-section", section);
    } catch {
      // Ignore private-mode storage errors.
    }
    useLibraryStore.getState().setRoute({ name: "settings" });
    void dismiss();
  };
  const segments = session.transcript ?? [];
  const hasTranscript = segments.length > 0;

  const transcribe = async () => {
    setTranscriptStatus("transcribing");
    setTranscriptError(null);
    try {
      const updated = await settingsService.transcribe(session.id);
      onSessionUpdate(updated);
      setTranscriptStatus("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTranscriptError(message);
      setTranscriptStatus("error");
    }
  };

  const generateSummary = async () => {
    setSummaryStatus("loading");
    setSummaryError(null);
    try {
      const updated = await settingsService.generateSummary(session.id);
      onSessionUpdate(updated);
      setSummaryStatus("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSummaryError(message);
      setSummaryStatus("error");
    }
  };

  const panels: Record<DetailTabId, ReactNode> = {
    screenshots: (
      <ScreenshotsTab captures={captures} selectedId={selectedCaptureId} onSelect={onSelectCapture} />
    ),
    transcript: (
      <TranscriptTab
        segments={segments}
        status={hasTranscript ? "ready" : transcriptStatus}
        configured={transcriptionConfigured}
        providerLabel={providerLabel}
        error={transcriptError}
        onSeek={seekAudio}
        onTranscribe={() => void transcribe()}
        onConfigure={() => openSettings("transcription")}
        onSendToNotion={sendToNotion}
      />
    ),
    summary: (
      <SummaryTab
        summary={session.summary}
        status={session.summary ? "ready" : summaryStatus}
        configured={aiConfigured}
        hasTranscript={hasTranscript}
        error={summaryError}
        onGenerate={() => void generateSummary()}
        onConfigure={() => openSettings("ai")}
        onSendToNotion={sendToNotion}
      />
    ),
  };

  return (
    <div className="detail-tabs">
      <div className="detail-tabs-nav" role="tablist" aria-label="Recording details" data-tab={tab}>
        <span className="detail-tab-indicator" aria-hidden="true" />
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`detail-tab ${tab === item.id ? "is-active" : ""}`}
            role="tab"
            id={`detail-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`detail-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => onTabChange(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
      <div
        className="detail-tab-card"
        role="tabpanel"
        id={`detail-panel-${tab}`}
        aria-labelledby={`detail-tab-${tab}`}
      >
        {panels[tab]}
      </div>
    </div>
  );
}
