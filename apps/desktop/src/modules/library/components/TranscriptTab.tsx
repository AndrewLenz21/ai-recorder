import { Button } from "@/shared/components/Button";
import { NotesIcon } from "@/shared/components/icons";
import { formatTimestamp } from "@/shared/lib/time";
import type { TranscriptSegment } from "@/tauri/types";

type Status = "empty" | "ready" | "transcribing" | "error";

type Props = {
  segments?: TranscriptSegment[];
  status?: Status;
  configured?: boolean;
  providerLabel?: string | null;
  error?: string | null;
  onSeek?: (seconds: number) => void;
  onTranscribe?: () => void;
  onConfigure?: () => void;
  onSendToNotion?: () => void;
};

export function TranscriptTab({
  segments = [],
  status = "empty",
  configured = false,
  providerLabel,
  error,
  onSeek,
  onTranscribe,
  onConfigure,
  onSendToNotion,
}: Props) {
  const ready = segments.length > 0 && status !== "transcribing";

  return (
    <div className="detail-tab-body">
      <div className="detail-tab-head">
        <p className="detail-tab-kicker">Full transcript</p>
        <Button variant="secondary" size="sm" onClick={onSendToNotion} disabled={!ready}>
          Send to Notion
        </Button>
      </div>
      {status === "transcribing" ? (
        <div className="detail-empty">
          <span className="detail-empty-mark is-busy">
            <NotesIcon size={18} />
          </span>
          <h3>Transcribing</h3>
          <p>Sending audio to the configured transcription provider.</p>
        </div>
      ) : ready ? (
        <ul className="transcript-list">
          {segments.map((segment) => (
            <li key={segment.id}>
              <button
                type="button"
                className="transcript-segment"
                onClick={() => onSeek?.(segment.startMs / 1000)}
              >
                <time dateTime={`${segment.startMs}ms`}>{formatTimestamp(segment.startMs)}</time>
                <p>{segment.text}</p>
              </button>
            </li>
          ))}
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
          {error ? <p className="error-text">{error}</p> : null}
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
