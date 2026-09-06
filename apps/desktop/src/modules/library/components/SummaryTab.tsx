import { Button } from "@/shared/components/Button";
import { SparkleIcon } from "@/shared/components/icons";

type Status = "idle" | "loading" | "ready" | "error";

type Props = {
  summary?: string | null;
  status?: Status;
  configured?: boolean;
  hasTranscript?: boolean;
  error?: string | null;
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
  onGenerate,
  onConfigure,
  onSendToNotion,
}: Props) {
  const ready = Boolean(summary) && status !== "loading";

  let title = "No summary yet";
  let body = "Generate an AI summary to capture the key points from this recording.";
  if (!configured) {
    body = "Configure an AI provider in Settings to generate summaries.";
  } else if (!hasTranscript) {
    body = "Transcribe this recording first, then generate a summary.";
  }

  return (
    <div className="detail-tab-body">
      <div className="detail-tab-head">
        <p className="detail-tab-kicker">AI summary</p>
        <Button variant="secondary" size="sm" onClick={onSendToNotion} disabled={!ready}>
          Send to Notion
        </Button>
      </div>
      {status === "loading" ? (
        <div className="detail-empty">
          <span className="detail-empty-mark is-busy">
            <SparkleIcon size={18} />
          </span>
          <h3>Generating summary</h3>
          <p>Using the configured AI provider.</p>
        </div>
      ) : summary ? (
        <div className="detail-summary">
          {summary.split("\n\n").map((paragraph) => (
            <p key={paragraph.slice(0, 32)}>{paragraph}</p>
          ))}
        </div>
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
