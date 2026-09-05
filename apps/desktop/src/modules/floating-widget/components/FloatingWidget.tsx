import { CaptureButton } from "@/modules/screen-capture";
import { ElapsedTime, useRecorder } from "@/modules/recorder";
import { NativeBridge } from "@/app/providers/NativeBridge";
import { IconButton } from "@/shared/components/IconButton";
import { OpenIcon, PauseIcon, PlayIcon, StopIcon } from "@/shared/components/icons";
import { windowCommands } from "@/tauri/commands/windows";

export function FloatingWidget() {
  return (
    <NativeBridge>
      <WidgetBody />
    </NativeBridge>
  );
}

function WidgetBody() {
  const { status, durationMs, pause, resume, stop } = useRecorder();
  const paused = status === "paused";

  return (
    <div className="widget-shell">
      <div className="widget" data-tauri-drag-region>
        <span className={`rec-dot ${paused ? "is-paused" : ""}`} />
        <ElapsedTime durationMs={durationMs} size="widget" />
        <div className="widget-actions">
          {paused ? (
            <IconButton label="Resume" onClick={() => void resume()}>
              <PlayIcon size={15} />
            </IconButton>
          ) : (
            <IconButton label="Pause" onClick={() => void pause()}>
              <PauseIcon size={15} />
            </IconButton>
          )}
          <IconButton label="Stop" onClick={() => void stop()}>
            <StopIcon size={14} />
          </IconButton>
          <CaptureButton compact />
          <IconButton label="Open AI Recorder" onClick={() => void windowCommands.showMain()}>
            <OpenIcon />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
