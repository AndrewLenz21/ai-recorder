import { convertFileSrc } from "@tauri-apps/api/core";

import { Button } from "@/shared/components/Button";
import { formatClock, formatDateTime, formatTimestamp } from "@/shared/lib/time";
import { useRecorderStore } from "../stores/recorder.store";
import { useRecorder } from "../hooks/useRecorder";

export function RecordingSummary() {
  const liveSession = useRecorderStore((state) => state.session);
  const viewingSession = useRecorderStore((state) => state.viewingSession);
  const session = viewingSession ?? liveSession;
  const { dismiss } = useRecorder();

  if (!session) {
    return null;
  }

  const captures = session.events.filter((event) => event.type === "screenCapture");

  return (
    <section className="summary">
      <p className="eyebrow">Recording</p>
      <h1>{formatClock(session.durationMs)}</h1>
      <p className="lede">{formatDateTime(session.startedAt)}</p>

      {session.audioFile ? (
        <div className="summary-block audio-block">
          <h2>Audio</h2>
          <audio
            className="audio-player"
            controls
            preload="metadata"
            src={convertFileSrc(session.audioFile)}
          />
        </div>
      ) : null}

      <div className="summary-block">
        <h2>Screenshots</h2>
        {captures.length === 0 ? (
          <p className="muted">No screenshots in this recording.</p>
        ) : (
          <ul className="capture-list">
            {captures.map((event) =>
              event.type === "screenCapture" ? (
                <li key={event.id} className="capture-row">
                  <img src={convertFileSrc(event.imagePath)} alt="" />
                  <div>
                    <strong>{formatTimestamp(event.timestampMs)}</strong>
                    <span>{event.fileName}</span>
                  </div>
                </li>
              ) : null,
            )}
          </ul>
        )}
      </div>

      <Button variant="primary" onClick={() => void dismiss()}>
        Done
      </Button>
    </section>
  );
}
