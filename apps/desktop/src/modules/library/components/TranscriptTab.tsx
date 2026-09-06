import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

import { Button } from "@/shared/components/Button";
import { Modal } from "@/shared/components/Modal";
import { CaptureIcon, ChevronDownIcon, MusicIcon, NotesIcon, RefreshIcon } from "@/shared/components/icons";
import { formatTimestamp } from "@/shared/lib/time";
import type { RecordingEvent, TranscriptKind, TranscriptRun, TranscriptSegment } from "@/tauri/types";

type Status = "empty" | "ready" | "transcribing" | "error";
type CaptureEvent = Extract<RecordingEvent, { type: "screenCapture" }>;
type Stage = "preparing" | "transcribing" | "timestamps";

const STAGES: { id: Stage; label: string }[] = [
  { id: "preparing", label: "Preparing audio" },
  { id: "transcribing", label: "Transcribing" },
  { id: "timestamps", label: "Processing timestamps" },
];

export type TranscriptChoice = {
  connectionId: string;
  model: string;
  label: string;
};

type Props = {
  segments?: TranscriptSegment[];
  captures?: CaptureEvent[];
  status?: Status;
  busy?: boolean;
  configured?: boolean;
  providerLabel?: string | null;
  choices?: TranscriptChoice[];
  selected?: TranscriptChoice | null;
  history?: TranscriptRun[];
  onSeek?: (seconds: number) => void;
  onCaptureSelect?: (id: string, timestampMs: number) => void;
  onSelectChoice?: (choice: TranscriptChoice) => void;
  onTranscribe?: () => void;
  onRestore?: (runId: string) => void;
  onConfigure?: () => void;
};

type Row =
  | { type: "segment"; segment: TranscriptSegment }
  | { type: "capture"; capture: CaptureEvent };

function transcriptRows(segments: TranscriptSegment[], captures: CaptureEvent[]): Row[] {
  const rows: Row[] = [];
  const shots = [...captures].sort((left, right) => left.timestampMs - right.timestampMs);
  let index = 0;
  let shot = 0;
  while (index < segments.length || shot < shots.length) {
    const segment = segments[index];
    const capture = shots[shot];
    if (capture && (!segment || capture.timestampMs <= segment.startMs)) {
      rows.push({ type: "capture", capture });
      shot += 1;
      continue;
    }
    if (segment) {
      rows.push({ type: "segment", segment });
      index += 1;
      while (shot < shots.length) {
        const nested = shots[shot];
        if (!nested || nested.timestampMs > segment.endMs) {
          break;
        }
        rows.push({ type: "capture", capture: nested });
        shot += 1;
      }
    }
  }
  return rows;
}

function markerKind(text: string): TranscriptKind {
  const trimmed = text.trim();
  const inner = trimmed.replace(/^[[(]|[\])]$/g, "").replace(/[♪♫*]/g, "").trim().toLowerCase();
  if (!inner || inner === "music" || inner === "singing" || trimmed === "♪" || trimmed === "♫") {
    return "music";
  }
  if (
    inner === "applause" ||
    inner === "laughter" ||
    inner === "laughing" ||
    inner === "silence" ||
    inner === "blank_audio" ||
    inner === "inaudible" ||
    inner === "noise" ||
    inner === "cough"
  ) {
    return "sound";
  }
  if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("(") && trimmed.endsWith(")"))) {
    return "sound";
  }
  return "speech";
}

function eventLabel(text: string, kind: TranscriptKind) {
  const inner = text.trim().replace(/^[[(]|[\])]$/g, "").replace(/[♪♫*]/g, "").trim();
  if (kind === "music") {
    return inner ? inner.charAt(0).toUpperCase() + inner.slice(1) : "Music";
  }
  if (!inner) {
    return "Sound";
  }
  return inner.charAt(0).toUpperCase() + inner.slice(1);
}

function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatAgo(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  if (Number.isNaN(delta) || delta < 60_000) {
    return "Just now";
  }
  if (delta < 3_600_000) {
    return `${Math.floor(delta / 60_000)} min ago`;
  }
  if (delta < 86_400_000) {
    return `${Math.floor(delta / 3_600_000)}h ago`;
  }
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

export function TranscriptTab({
  segments = [],
  captures = [],
  status = "empty",
  busy = false,
  configured = false,
  providerLabel,
  choices = [],
  selected = null,
  history = [],
  onSeek,
  onCaptureSelect,
  onSelectChoice,
  onTranscribe,
  onRestore,
  onConfigure,
}: Props) {
  const ready = segments.length > 0 && status !== "transcribing";
  const rows = transcriptRows(segments, captures);
  const [stage, setStage] = useState<Stage>("preparing");
  const [elapsed, setElapsed] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (status !== "transcribing") {
      setStage("preparing");
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const tick = window.setInterval(() => setElapsed(Date.now() - started), 250);
    const unlisten = listen<string>("transcription:stage", (event) => {
      if (event.payload === "preparing" || event.payload === "transcribing" || event.payload === "timestamps") {
        setStage(event.payload);
      }
    });
    return () => {
      window.clearInterval(tick);
      void unlisten.then((fn) => fn());
    };
  }, [status]);

  return (
    <div className="detail-tab-body">
      <div className="detail-tab-head">
        <p className="transcript-title">Transcript</p>
        <div className="transcript-head-actions">
          {ready || (busy && segments.length > 0) ? (
            <button
              type="button"
              className={`transcript-retry ${busy ? "is-busy" : ""}`}
              aria-label="Transcribe again"
              title={busy ? undefined : "Transcribe again"}
              disabled={busy}
              onClick={onTranscribe}
            >
              {busy ? <span className="app-spinner" /> : <RefreshIcon size={14} />}
              <span className="transcript-retry-label">
                <span>Transcribe again</span>
              </span>
            </button>
          ) : null}
          {choices.length > 0 ? (
            <button type="button" className="transcript-model" onClick={() => setPickerOpen(true)}>
              <span>{selected?.label ?? providerLabel ?? "Choose model"}</span>
              <ChevronDownIcon size={14} />
            </button>
          ) : null}
        </div>
      </div>
      <Modal open={pickerOpen} title="Transcript" subtitle="Choose a model or restore a previous run." size="picker" onClose={() => setPickerOpen(false)}>
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
          {history.length > 0 ? (
            <>
              <p className="folder-field-label">History</p>
              {history.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  className="provider-picker-row"
                  onClick={() => {
                    onRestore?.(run.id);
                    setPickerOpen(false);
                  }}
                >
                  <strong>
                    {run.provider}
                    {run.model ? ` · ${run.model}` : ""}
                  </strong>
                  <span>{formatAgo(run.createdAt)}</span>
                </button>
              ))}
            </>
          ) : null}
        </div>
      </Modal>
      {status === "transcribing" ? (
        <div className="transcript-process">
          <h3>Transcribing recording</h3>
          <div className="transcript-wave" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          {providerLabel ? (
            <p className="transcript-process-meta">
              Provider
              <strong>{providerLabel}</strong>
            </p>
          ) : null}
          <ol className="transcript-stages">
            {STAGES.map((item, index) => {
              const current = STAGES.findIndex((entry) => entry.id === stage);
              return (
                <li
                  key={item.id}
                  className={index === current ? "is-active" : index < current ? "is-done" : ""}
                >
                  {item.label}
                </li>
              );
            })}
          </ol>
          <p className="transcript-elapsed">{formatElapsed(elapsed)}</p>
        </div>
      ) : ready ? (
        <ul className="transcript-list">
          {rows.map((row) =>
            row.type === "segment" ? (
              <li key={row.segment.id}>
                <button
                  type="button"
                  className="transcript-segment"
                  onClick={() => onSeek?.(row.segment.startMs / 1000)}
                >
                  <time dateTime={`${row.segment.startMs}ms`}>{formatTimestamp(row.segment.startMs)}</time>
                  {(() => {
                    const kind = row.segment.kind ?? markerKind(row.segment.text);
                    if (kind === "speech") {
                      return <p>{row.segment.text}</p>;
                    }
                    return (
                      <p className={`transcript-event is-${kind}`}>
                        {kind === "music" ? <MusicIcon size={13} /> : null}
                        <span>{eventLabel(row.segment.text, kind)}</span>
                      </p>
                    );
                  })()}
                </button>
              </li>
            ) : (
              <li key={row.capture.id}>
                <button
                  type="button"
                  className="transcript-shot"
                  onClick={() => {
                    onSeek?.(row.capture.timestampMs / 1000);
                    onCaptureSelect?.(row.capture.id, row.capture.timestampMs);
                  }}
                >
                  <img src={convertFileSrc(row.capture.imagePath)} alt="" />
                  <span className="transcript-shot-copy">
                    <strong>On screen</strong>
                    <span>Captured here · {formatTimestamp(row.capture.timestampMs)}</span>
                  </span>
                  <CaptureIcon size={14} />
                </button>
              </li>
            ),
          )}
        </ul>
      ) : (
        <div className="detail-empty">
          <span className="detail-empty-mark">
            <NotesIcon size={18} />
          </span>
          <h3>No transcript yet</h3>
          <p>
            {configured
              ? "Transcribe this recording using the default provider."
              : "Configure a transcription provider to turn this recording into text."}
          </p>
          {configured && providerLabel ? <p className="muted">{providerLabel}</p> : null}
          {configured && onTranscribe ? (
            <Button variant="primary" size="md" onClick={onTranscribe}>
              Transcribe recording
            </Button>
          ) : onConfigure ? (
            <Button variant="primary" size="md" onClick={onConfigure}>
              Configure transcription
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
