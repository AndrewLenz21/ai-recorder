import { convertFileSrc } from "@tauri-apps/api/core";

import { CaptureIcon } from "@/shared/components/icons";
import { formatTimestamp } from "@/shared/lib/time";
import type { RecordingEvent } from "@/tauri/types";

type CaptureEvent = Extract<RecordingEvent, { type: "screenCapture" }>;

type Props = {
  captures: CaptureEvent[];
  selectedId: string | null;
  onSelect: (id: string, timestampMs: number) => void;
};

export function ScreenshotsTab({ captures, selectedId, onSelect }: Props) {
  if (captures.length === 0) {
    return (
      <div className="detail-empty">
        <span className="detail-empty-mark">
          <CaptureIcon size={18} />
        </span>
        <h3>No screenshots</h3>
        <p>Captures taken during this recording will show up here.</p>
      </div>
    );
  }

  return (
    <ul className="capture-grid">
      {captures.map((event) => (
        <li key={event.id} id={`capture-${event.id}`}>
          <button
            type="button"
            className={`capture-tile ${selectedId === event.id ? "is-selected" : ""}`}
            onClick={() => onSelect(event.id, event.timestampMs)}
          >
            <img src={convertFileSrc(event.imagePath)} alt="" />
            <span>{formatTimestamp(event.timestampMs)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
