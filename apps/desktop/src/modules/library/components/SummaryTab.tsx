import { Button } from "@/shared/components/Button";
import { SparkleIcon } from "@/shared/components/icons";

type Status = "idle" | "loading" | "ready";

type Props = {
  summary?: string | null;
  status?: Status;
  onGenerate?: () => void;
  onSendToNotion?: () => void;
};

export function SummaryTab({ summary = null, status = "idle", onGenerate, onSendToNotion }: Props) {
  const ready = status === "ready" && Boolean(summary);

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
          <p>This will only take a moment.</p>
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
          <h3>No summary yet</h3>
          <p>Generate an AI summary to capture the key points from this recording.</p>
          {onGenerate ? (
            <Button variant="primary" size="md" onClick={onGenerate}>
              Generate Summary
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
