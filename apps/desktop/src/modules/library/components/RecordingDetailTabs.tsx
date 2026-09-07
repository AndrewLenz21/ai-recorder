import { useMemo, useState, type ReactNode } from "react";

import { seekAudio } from "@/modules/audio-player";
import { providerModelLabel } from "@/modules/settings/catalog";
import { settingsService } from "@/modules/settings/services/settings.service";
import { CaptureIcon, NotesIcon, SparkleIcon } from "@/shared/components/icons";
import { showToast } from "@/shared/stores/toast.store";
import type { AppSettings, ProviderConnection } from "@/tauri/commands/settings";
import type { RecordingEvent, RecordingSession, TranscriptSource } from "@/tauri/types";

import { useLibraryStore } from "../stores/library.store";
import { useRecorder } from "@/modules/recorder";

import { ScreenshotsTab } from "./ScreenshotsTab";
import { SummaryTab, type SummaryChoice } from "./SummaryTab";
import { TranscriptTab, type TranscriptChoice } from "./TranscriptTab";

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
  const rows = (settings?.connections.filter((item) => item.capability === capability) ?? []).filter(
    (item) => capability !== "transcription" || item.type !== "novita",
  );
  const marked = rows.find((item) => item.isDefault);
  if (capability === "transcription" && marked?.type === "local") {
    const cloud = rows.find((item) => item.type !== "local" && item.hasCredential);
    if (cloud) {
      return cloud;
    }
  }
  return marked ?? rows[0];
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
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [choice, setChoice] = useState<TranscriptChoice | null>(null);
  const [aiChoice, setAiChoice] = useState<SummaryChoice | null>(null);
  const hasMic = Boolean(session.audioTracks?.some((track) => track.kind === "microphone") || session.audioFile);
  const hasSystem = Boolean(session.audioTracks?.some((track) => track.kind === "system"));
  const [source, setSource] = useState<TranscriptSource>(
    session.transcriptSource ?? (hasMic && hasSystem ? "both" : hasMic ? "microphone" : "mixed"),
  );

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
  const choices = useMemo<TranscriptChoice[]>(() => {
    if (!settings) {
      return [];
    }
    const rows: TranscriptChoice[] = [];
    for (const connection of settings.connections) {
      if (connection.capability !== "transcription" || connection.type === "novita") {
        continue;
      }
      if (connection.type === "local") {
        for (const model of settings.localModels.filter((item) => item.installed)) {
          rows.push({
            connectionId: connection.id,
            model: model.id,
            label: `Local · Whisper ${model.label}`,
          });
        }
        continue;
      }
      if (!connection.hasCredential) {
        continue;
      }
      rows.push({
        connectionId: connection.id,
        model: connection.model,
        label: `${connection.displayName} · ${providerModelLabel("transcription", connection.type, connection.model)}`,
      });
    }
    return rows;
  }, [settings]);
  const selected =
    choice ??
    choices.find((item) => item.connectionId === transcription?.id && item.model === transcription.model) ??
    choices[0] ??
    null;
  const aiChoices = useMemo<SummaryChoice[]>(() => {
    if (!settings) {
      return [];
    }
    const rows: SummaryChoice[] = [];
    for (const connection of settings.connections) {
      if (connection.capability !== "ai" || !connection.hasCredential) {
        continue;
      }
      const models =
        connection.enabledModels.length > 0 ? connection.enabledModels : connection.model ? [connection.model] : [];
      if (models.length === 0) {
        rows.push({
          connectionId: connection.id,
          model: connection.model,
          label: connection.displayName,
        });
        continue;
      }
      for (const model of models) {
        rows.push({
          connectionId: connection.id,
          model,
          label: `${connection.displayName} · ${providerModelLabel("ai", connection.type, model)}`,
        });
      }
    }
    return rows;
  }, [settings]);
  const selectedAi =
    aiChoice ??
    aiChoices.find((item) => item.connectionId === ai?.id && item.model === ai.model) ??
    aiChoices[0] ??
    null;

  const transcribe = async () => {
    setTranscriptStatus("transcribing");
    try {
      const updated = await settingsService.transcribe(session.id, selected?.connectionId, selected?.model, source);
      onSessionUpdate(updated);
      setTranscriptStatus("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTranscriptStatus(hasTranscript ? "ready" : "empty");
      showToast("error", "Transcription failed", message);
    }
  };

  const restore = async (runId: string) => {
    try {
      onSessionUpdate(await settingsService.restoreTranscript(session.id, runId));
      setTranscriptStatus("ready");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : String(error));
    }
  };

  const generateSummary = async () => {
    setSummaryStatus("loading");
    setSummaryError(null);
    try {
      const updated = await settingsService.generateSummary(session.id, selectedAi?.connectionId, selectedAi?.model);
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
        captures={captures}
        status={transcriptStatus === "transcribing" && !hasTranscript ? "transcribing" : hasTranscript ? "ready" : transcriptStatus}
        busy={transcriptStatus === "transcribing"}
        configured={transcriptionConfigured}
        providerLabel={providerLabel}
        choices={choices}
        selected={selected}
        history={session.transcriptHistory ?? []}
        sources={
          hasMic && hasSystem
            ? [
                { id: "both", label: "Conversation" },
                { id: "microphone", label: "Microphone" },
                { id: "system", label: "Computer" },
                { id: "mixed", label: "Mixed" },
              ]
            : []
        }
        selectedSource={source}
        onSeek={seekAudio}
        onCaptureSelect={onSelectCapture}
        onSelectChoice={setChoice}
        onSelectSource={setSource}
        onTranscribe={() => void transcribe()}
        onRestore={(runId) => void restore(runId)}
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
        choices={aiChoices}
        selected={selectedAi}
        onSelectChoice={setAiChoice}
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
