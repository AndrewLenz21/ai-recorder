import { useState } from "react";

import { Button } from "@/shared/components/Button";
import { Markdown } from "@/shared/components/Markdown";
import { Modal } from "@/shared/components/Modal";
import { OverflowMenu } from "@/shared/components/OverflowMenu";
import { CopyIcon, NotionIcon, RefreshIcon, SparkleIcon } from "@/shared/components/icons";
import { showToast } from "@/shared/stores/toast.store";

export type SummaryChoice = {
  connectionId: string;
  model: string;
  label: string;
};

type Status = "idle" | "loading" | "ready" | "error";

type Props = {
  summary?: string | null;
  status?: Status;
  configured?: boolean;
  hasTranscript?: boolean;
  error?: string | null;
  choices?: SummaryChoice[];
  selected?: SummaryChoice | null;
  onSelectChoice?: (choice: SummaryChoice) => void;
  onGenerate?: () => void;
  onConfigure?: () => void;
  onSendToNotion?: () => void;
};

export function SummaryTab({
  summary = null,
  status = "idle",
  configured = false,
  hasTranscript = false,
  error,
  choices = [],
  selected = null,
  onSelectChoice,
  onGenerate,
  onConfigure,
  onSendToNotion,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const ready = Boolean(summary) && status !== "loading";
  const busy = status === "loading";

  let title = "No summary yet";
  let body = "Generate an AI summary to capture the key points from this recording.";
  if (!configured) {
    body = "Configure an AI provider in Settings to generate summaries.";
  } else if (!hasTranscript) {
    body = "Transcribe this recording first, then generate a summary.";
  }

  const copySummary = async () => {
    if (!summary) {
      return;
    }
    try {
      await navigator.clipboard.writeText(summary);
      showToast("success", "Summary copied");
    } catch {
      showToast("error", "Could not copy summary");
    }
  };

  return (
    <div className="detail-tab-body">
      <div className="detail-tab-head">
        <p className="detail-tab-kicker">AI summary</p>
        <OverflowMenu
          label="Summary options"
          items={[
            ...(ready
              ? [
                  { id: "copy", label: "Copy", icon: <CopyIcon size={16} />, onSelect: () => void copySummary() },
                  { id: "notion", label: "Send to Notion", icon: <NotionIcon size={16} />, onSelect: () => onSendToNotion?.() },
                ]
              : []),
            ...(ready && onGenerate
              ? [
                  {
                    id: "again",
                    label: "Generate again",
                    icon: <RefreshIcon size={16} />,
                    disabled: busy,
                    onSelect: onGenerate,
                  },
                ]
              : []),
            ...(choices.length > 0
              ? [
                  {
                    id: "model",
                    label: selected?.label ?? "Choose model",
                    icon: <SparkleIcon size={16} />,
                    onSelect: () => setPickerOpen(true),
                  },
                ]
              : []),
          ]}
        />
      </div>
      <Modal
        open={pickerOpen}
        title="AI summary"
        subtitle="Choose a model for this summary."
        size="picker"
        onClose={() => setPickerOpen(false)}
      >
        <div className="transcript-picker">
          <p className="folder-field-label">Models</p>
          {choices.map((choice) => (
            <button
              key={`${choice.connectionId}:${choice.model}`}
              type="button"
              className={`provider-picker-row ${selected?.connectionId === choice.connectionId && selected.model === choice.model ? "is-active" : ""}`}
              onClick={() => {
                onSelectChoice?.(choice);
                setPickerOpen(false);
              }}
            >
              <strong>{choice.label}</strong>
            </button>
          ))}
        </div>
      </Modal>
      {busy ? (
        <div className="detail-empty">
          <span className="detail-empty-mark is-busy">
            <SparkleIcon size={18} />
          </span>
          <h3>Generating summary</h3>
          <p>{selected?.label ? `Using ${selected.label}.` : "Using the configured AI provider."}</p>
        </div>
      ) : summary ? (
        <Markdown className="detail-summary" text={summary} />
      ) : (
        <div className="detail-empty">
          <span className="detail-empty-mark">
            <SparkleIcon size={18} />
          </span>
          <h3>{title}</h3>
          <p>{body}</p>
          {error ? <p className="error-text">{error}</p> : null}
          {configured && hasTranscript && onGenerate ? (
            <Button variant="primary" size="md" onClick={onGenerate}>
              Generate Summary
            </Button>
          ) : !configured && onConfigure ? (
            <Button variant="primary" size="md" onClick={onConfigure}>
              Configure AI provider
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
