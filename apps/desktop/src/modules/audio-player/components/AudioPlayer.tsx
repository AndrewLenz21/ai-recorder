import { PauseIcon, PlayIcon } from "@/shared/components/icons";
import { formatTimestamp } from "@/shared/lib/time";

import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { SeekBar } from "./SeekBar";

export function AudioPlayer() {
  const { playing, currentTime, duration, toggle, skip, error } = useAudioPlayer();

  return (
    <div className="flex flex-col gap-2.5 px-0 pt-2 pb-1">
      <SeekBar />
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{formatTimestamp(currentTime * 1000)}</span>
        <span>{formatTimestamp(duration * 1000)}</span>
      </div>
      <div className="flex items-center justify-center gap-[22px] pt-1">
        <button
          type="button"
          className="min-w-10 border-0 bg-transparent text-[13px] font-[650] text-muted-foreground tabular-nums hover:text-foreground"
          aria-label="Back 15 seconds"
          onClick={() => skip(-15)}
        >
          −15
        </button>
        <button
          type="button"
          className="inline-flex size-[52px] items-center justify-center rounded-full border-0 bg-control text-control-foreground transition-transform duration-[var(--duration)] ease-app hover:scale-[1.04] active:scale-[0.96]"
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => void toggle()}
        >
          {playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
        </button>
        <button
          type="button"
          className="min-w-10 border-0 bg-transparent text-[13px] font-[650] text-muted-foreground tabular-nums hover:text-foreground"
          aria-label="Forward 15 seconds"
          onClick={() => skip(15)}
        >
          +15
        </button>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
