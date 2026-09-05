import { useEffect } from "react";

import { Button } from "@/shared/components/Button";
import { RecordIcon } from "@/shared/components/icons";
import { formatDateTime, formatTimestamp } from "@/shared/lib/time";
import { MeetingHint } from "@/modules/meeting-detection";

import { useRecorder } from "../hooks/useRecorder";

export function RecorderHome() {
  const { start, recents, openSession, refreshRecents, error } = useRecorder();

  useEffect(() => {
    void refreshRecents();
  }, [refreshRecents]);

  return (
    <section className="home">
      <div className="home-hero">
        <p className="eyebrow">AI Recorder</p>
        <h1>Ready when you are.</h1>
        <p className="lede">Record audio, capture the screen, and keep every moment on a shared timeline.</p>
        <Button variant="record" size="lg" onClick={() => void start()}>
          <RecordIcon />
          Start recording
        </Button>
        {error ? <p className="error-text">{error}</p> : null}
        <MeetingHint />
      </div>

      {recents.length > 0 ? (
        <div className="recents">
          <h2>Recent</h2>
          <ul>
            {recents.map((item) => (
              <li key={item.id}>
                <button type="button" className="recent-row" onClick={() => void openSession(item.id)}>
                  <span className="recent-time">{formatTimestamp(item.durationMs)}</span>
                  <span className="recent-meta">
                    {formatDateTime(item.startedAt)}
                    {item.screenshotCount > 0
                      ? ` · ${item.screenshotCount} screenshot${item.screenshotCount === 1 ? "" : "s"}`
                      : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
