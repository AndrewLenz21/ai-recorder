import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAudioPlayer } from "@/modules/audio-player";
import { Button } from "@/shared/components/Button";
import { Modal } from "@/shared/components/Modal";
import { OverflowMenu } from "@/shared/components/OverflowMenu";
import { CaptureIcon, CopyIcon, MusicIcon, NotesIcon, NotionIcon, RefreshIcon } from "@/shared/components/icons";
import { formatTimestamp } from "@/shared/lib/time";
import { showToast } from "@/shared/stores/toast.store";
import type { RecordingEvent, TranscriptKind, TranscriptRun, TranscriptSegment, TranscriptSource } from "@/tauri/types";

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
  sources?: { id: TranscriptSource; label: string }[];
  selectedSource?: TranscriptSource;
  onSeek?: (seconds: number) => void;
  onCaptureSelect?: (id: string, timestampMs: number) => void;
  onSelectChoice?: (choice: TranscriptChoice) => void;
  onSelectSource?: (source: TranscriptSource) => void;
  onTranscribe?: () => void;
  onRestore?: (runId: string) => void;
  onConfigure?: () => void;
  onSendToNotion?: () => void;
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

function timingMode(segments: TranscriptSegment[]): "word" | "segment" | "none" {
  if (segments.some((segment) => (segment.words?.length ?? 0) > 0)) {
    return "word";
  }
  if (segments.some((segment) => segment.endMs > segment.startMs)) {
    return "segment";
  }
  return "none";
}

function SpeechText({
  segment,
  timeMs,
  mode,
  onSeek,
}: {
  segment: TranscriptSegment;
  timeMs: number;
  mode: "word" | "segment" | "none";
  onSeek?: (seconds: number) => void;
}) {
  const words = segment.words ?? [];
  if (mode !== "word" || words.length === 0) {
    return <p>{segment.text}</p>;
  }
  return (
    <p className="transcript-words">
      {words.map((word, index) => {
        const active = timeMs >= word.startMs && timeMs < Math.max(word.endMs, word.startMs + 40);
        const passed = word.endMs <= timeMs;
        return (
          <span key={`${word.startMs}-${index}`}>
            {index > 0 ? " " : null}
            <button
              type="button"
              className={`transcript-word ${active ? "is-active" : passed ? "is-passed" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                onSeek?.(word.startMs / 1000);
              }}
            >
              {word.text}
            </button>
          </span>
        );
      })}
    </p>
  );
}

const SOURCE_LABELS: Record<"microphone" | "system", { icon: string; label: string }> = {
  microphone: { icon: "🎙️", label: "Mic" },
  system: { icon: "💻", label: "Computer" },
};

function sourceLabel(source?: TranscriptSource | null) {
  if (source === "microphone" || source === "system") {
    return SOURCE_LABELS[source];
  }
  return null;
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
  sources = [],
  selectedSource = "mixed",
  onSeek,
  onCaptureSelect,
  onSelectChoice,
  onSelectSource,
  onTranscribe,
  onRestore,
  onConfigure,
  onSendToNotion,
}: Props) {
  const ready = segments.length > 0 && status !== "transcribing";
  const rows = transcriptRows(segments, captures);
  const mode = useMemo(() => timingMode(segments), [segments]);
  const { currentTime } = useAudioPlayer();
  const timeMs = currentTime * 1000;
  const [stage, setStage] = useState<Stage>("preparing");
  const [elapsed, setElapsed] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [following, setFollowing] = useState(true);
  const listRef = useRef<HTMLUListElement>(null);
  const activeId = useMemo(() => {
    if (mode === "none") {
      return null;
    }
    const current = segments.find((segment) => timeMs >= segment.startMs && timeMs < Math.max(segment.endMs, segment.startMs + 1));
    return current?.id ?? null;
  }, [mode, segments, timeMs]);

  useEffect(() => {
    if (!following || !activeId || !listRef.current) {
      return;
    }
    const row = listRef.current.querySelector(`[data-segment="${activeId}"]`);
    const root = listRef.current.closest(".detail-tab-body");
    if (!(row instanceof HTMLElement) || !(root instanceof HTMLElement)) {
      return;
    }
    const rowRect = row.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    if (rowRect.top < rootRect.top + 12 || rowRect.bottom > rootRect.bottom - 12) {
      row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeId, following]);

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
        <OverflowMenu
          label="Transcript options"
          items={[
            ...(ready
              ? [
                  {
                    id: "copy",
                    label: "Copy",
                    icon: <CopyIcon size={16} />,
                    onSelect: () => {
                      void navigator.clipboard
                        .writeText(segments.map((segment) => segment.text).join("\n\n"))
                        .then(() => showToast("success", "Transcript copied"))
                        .catch(() => showToast("error", "Could not copy transcript"));
                    },
                  },
                  {
                    id: "notion",
                    label: "Send to Notion",
                    icon: <NotionIcon size={16} />,
                    onSelect: () => onSendToNotion?.(),
                  },
                ]
              : []),
            ...(ready || (busy && segments.length > 0)
              ? [
                  {
                    id: "again",
                    label: "Transcribe again",
                    icon: <RefreshIcon size={16} />,
                    disabled: busy,
                    onSelect: () => onTranscribe?.(),
                  },
                ]
              : []),
            ...(ready && !following
              ? [
                  {
                    id: "follow",
                    label: "Follow playback",
                    icon: <NotesIcon size={16} />,
                    onSelect: () => setFollowing(true),
                  },
                ]
              : []),
            ...(choices.length > 0
              ? [
                  {
                    id: "model",
                    label: selected?.label ?? providerLabel ?? "Choose model",
                    icon: <NotesIcon size={16} />,
                    onSelect: () => setPickerOpen(true),
                  },
                ]
              : []),
          ]}
        />
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
          {sources.length > 1 ? (
            <>
              <p className="folder-field-label">Audio source</p>
              {sources.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`provider-picker-row ${selectedSource === item.id ? "is-active" : ""}`}
                  onClick={() => onSelectSource?.(item.id)}
                >
                  <strong>{item.label}</strong>
                </button>
              ))}
            </>
          ) : null}
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
        <ul
          ref={listRef}
          className="transcript-list"
          onWheel={() => {
            if (following) {
              setFollowing(false);
            }
          }}
        >
          {rows.map((row, index) =>
            row.type === "segment" ? (
              <li key={row.segment.id} data-segment={row.segment.id}>
                {(() => {
                  const speaker = sourceLabel(row.segment.source);
                  const previous = [...rows.slice(0, index)].reverse().find((item) => item.type === "segment");
                  const showSpeaker = speaker && previous?.type === "segment"
                    ? previous.segment.source !== row.segment.source
                    : Boolean(speaker);
                  const kind = row.segment.kind ?? markerKind(row.segment.text);
                  return (
                <div
                  className={`transcript-segment ${mode !== "none" && row.segment.id === activeId ? "is-active" : ""} ${row.segment.source === "microphone" ? "is-mic" : row.segment.source === "system" ? "is-system" : ""}`}
                  onClick={() => onSeek?.(row.segment.startMs / 1000)}
                >
                  <button
                    type="button"
                    className="transcript-time"
                    onClick={() => onSeek?.(row.segment.startMs / 1000)}
                  >
                    <time dateTime={`${row.segment.startMs}ms`}>{formatTimestamp(row.segment.startMs)}</time>
                  </button>
                  <div className="transcript-copy">
                    {showSpeaker && speaker ? (
                      <p className="transcript-speaker">
                        <span aria-hidden="true">{speaker.icon}</span>
                        {speaker.label}
                      </p>
                    ) : null}
                  {kind === "speech" ? (
                      <SpeechText
                        segment={row.segment}
                        timeMs={timeMs}
                        mode={mode}
                        onSeek={onSeek}
                      />
                  ) : (
                      <p className={`transcript-event is-${kind}`}>
                        {kind === "music" ? <MusicIcon size={13} /> : null}
                        <span>{eventLabel(row.segment.text, kind)}</span>
                      </p>
                  )}
                  </div>
                </div>
                  );
                })()}
              </li>
            ) : (
              <li key={row.capture.id}>
                <button
                  type="button"
                  className={`transcript-shot ${Math.abs(timeMs - row.capture.timestampMs) <= 450 ? "is-active" : ""}`}
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
