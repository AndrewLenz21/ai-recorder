import { Button } from "@/shared/components/Button";
import { NotesIcon } from "@/shared/components/icons";
import { formatTimestamp } from "@/shared/lib/time";

export type TranscriptSegment = {
  id: string;
  startMs: number;
  text: string;
};

type Props = {
  segments?: TranscriptSegment[];
  onSeek?: (seconds: number) => void;
  onSendToNotion?: () => void;
};

export function TranscriptTab({ segments = [], onSeek, onSendToNotion }: Props) {
  return (
    <div className="detail-tab-body">
      <div className="detail-tab-head">
        <p className="detail-tab-kicker">Full transcript</p>
        <Button variant="secondary" size="sm" onClick={onSendToNotion}>
          Send to Notion
        </Button>
      </div>
      {segments.length === 0 ? (
        <div className="detail-empty">
          <span className="detail-empty-mark">
            <NotesIcon size={18} />
          </span>
          <h3>No transcript yet</h3>
          <p>Once this recording is processed, timestamped segments will appear here.</p>
        </div>
      ) : (
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
      )}
    </div>
  );
}
