import type { ReactNode } from "react";

import { seekAudio } from "@/modules/audio-player";
import { CaptureIcon, NotesIcon, SparkleIcon } from "@/shared/components/icons";
import { showToast } from "@/shared/stores/toast.store";
import type { RecordingEvent } from "@/tauri/types";

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
  captures: CaptureEvent[];
  selectedCaptureId: string | null;
  onSelectCapture: (id: string, timestampMs: number) => void;
  tab: DetailTabId;
  onTabChange: (tab: DetailTabId) => void;
};

function sendToNotion() {
  showToast("error", "Notion export isn’t available yet");
}

export function RecordingDetailTabs({
  captures,
  selectedCaptureId,
  onSelectCapture,
  tab,
  onTabChange,
}: Props) {
  const panels: Record<DetailTabId, ReactNode> = {
    screenshots: (
      <ScreenshotsTab captures={captures} selectedId={selectedCaptureId} onSelect={onSelectCapture} />
    ),
    transcript: <TranscriptTab onSeek={seekAudio} onSendToNotion={sendToNotion} />,
    summary: (
      <SummaryTab
        onGenerate={() => showToast("error", "Summary isn’t available yet")}
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
