import { AudioBarsIcon, CaptureIcon, ClockIcon } from "@/shared/components/icons";
import { formatTimestamp } from "@/shared/lib/time";
import { useRecorder } from "@/modules/recorder";
import type { SessionSummary } from "@/tauri/types";

import { recordingTitle } from "../utils/recordings";
import { ItemMeta } from "./ItemMeta";
import { RecordingOptions } from "./RecordingOptions";

type Props = {
  recording: SessionSummary;
};

export function RecordingRow({ recording }: Props) {
  const { openSession } = useRecorder();

  return (
    <div className="recent-item">
      <button type="button" className="recording-main is-recent" onClick={() => void openSession(recording.id)}>
        <span className="row-lead">
          <span className="recording-mark is-small">
            <AudioBarsIcon size={14} />
          </span>
        </span>
        <span className="library-row-copy">
          <strong>{recordingTitle(recording)}</strong>
          <span className="library-tile-meta">
            <ItemMeta icon={<ClockIcon size={12} />} value={formatTimestamp(recording.durationMs)} />
            <ItemMeta icon={<CaptureIcon size={12} />} value={recording.screenshotCount} />
          </span>
        </span>
      </button>
      <RecordingOptions recording={recording} />
    </div>
  );
}
