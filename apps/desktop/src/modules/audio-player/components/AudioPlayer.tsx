import { PauseIcon, PlayIcon, SeekBackIcon, SeekForwardIcon } from "@/shared/components/icons";
import { formatTimestamp } from "@/shared/lib/time";

import { useAudioPlayer } from "../hooks/useAudioPlayer";
import type { ScreenshotCue } from "../types";
import { AudioWaveform } from "./AudioWaveform";

type Props = {
  screenshots?: ScreenshotCue[];
  selectedScreenshotId?: string | null;
  onScreenshotSelect?: (id: string) => void;
};

export function AudioPlayer({ screenshots, selectedScreenshotId, onScreenshotSelect }: Props) {
  const { playing, currentTime, duration, toggle, skip, error } = useAudioPlayer();
  const atStart = currentTime <= 0.05;
  const atEnd = duration > 0 && currentTime >= duration - 0.05;

  return (
    <div className="flex flex-col gap-2.5 px-0 pt-2 pb-1">
      <AudioWaveform
        screenshots={screenshots}
        selectedScreenshotId={selectedScreenshotId}
        onScreenshotSelect={onScreenshotSelect}
      />
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{formatTimestamp(currentTime * 1000)}</span>
        <span>{formatTimestamp(duration * 1000)}</span>
      </div>
      <div className="player-controls">
        <div className="player-seeks">
          <button
            type="button"
            className="player-seek"
            aria-label="Back 15 seconds"
            title="Back 15 seconds"
            disabled={atStart}
            onClick={() => skip(-15)}
          >
            <SeekBackIcon size={26} seconds={15} />
          </button>
          <button
            type="button"
            className="player-seek"
            aria-label="Back 5 seconds"
            title="Back 5 seconds"
            disabled={atStart}
            onClick={() => skip(-5)}
          >
            <SeekBackIcon size={26} seconds={5} />
          </button>
        </div>
        <button
          type="button"
          className="inline-flex size-[52px] items-center justify-center rounded-full border-0 bg-control text-control-foreground transition-transform duration-[var(--duration)] ease-app hover:scale-[1.04] active:scale-[0.96]"
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => void toggle()}
        >
          {playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
        </button>
        <div className="player-seeks">
          <button
            type="button"
            className="player-seek"
            aria-label="Forward 5 seconds"
            title="Forward 5 seconds"
            disabled={atEnd}
            onClick={() => skip(5)}
          >
            <SeekForwardIcon size={26} seconds={5} />
          </button>
          <button
            type="button"
            className="player-seek"
            aria-label="Forward 15 seconds"
            title="Forward 15 seconds"
            disabled={atEnd}
            onClick={() => skip(15)}
          >
            <SeekForwardIcon size={26} seconds={15} />
          </button>
        </div>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
