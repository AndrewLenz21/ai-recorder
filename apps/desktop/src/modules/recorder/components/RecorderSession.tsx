import { Button } from "@/shared/components/Button";
import { PauseIcon, PlayIcon, StopIcon } from "@/shared/components/icons";
import { CaptureButton, CaptureFlash } from "@/modules/screen-capture";
import { MeetingHint } from "@/modules/meeting-detection";
import { TimelineList } from "@/modules/timeline";

import { useRecorder } from "../hooks/useRecorder";
import { ElapsedTime } from "./ElapsedTime";

export function RecorderSession() {
  const { status, durationMs, pause, resume, stop, error } = useRecorder();
  const paused = status === "paused";

  return (
    <section className="session">
      <CaptureFlash />
      <div className={`session-status ${paused ? "is-paused" : "is-live"}`}>
        <span className="rec-dot" />
        <span>{paused ? "Paused" : "Recording"}</span>
      </div>
      <ElapsedTime durationMs={durationMs} />
      <div className="session-actions">
        {paused ? (
          <Button variant="secondary" onClick={() => void resume()}>
            <PlayIcon />
            Resume
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => void pause()}>
            <PauseIcon />
            Pause
          </Button>
        )}
        <CaptureButton />
        <Button variant="stop" onClick={() => void stop()}>
          <StopIcon />
          Stop
        </Button>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <MeetingHint compact />
      <TimelineList compact />
    </section>
  );
}
