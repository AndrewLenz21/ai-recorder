import { PauseIcon, PlayIcon } from "@/shared/components/icons";
import { formatTimestamp } from "@/shared/lib/time";

import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { SeekBar } from "./SeekBar";

export function AudioPlayer() {
  const { playing, currentTime, duration, toggle, skip, error } = useAudioPlayer();

  return (
    <div className="player">
      <SeekBar />
      <div className="player-times">
        <span>{formatTimestamp(currentTime * 1000)}</span>
        <span>{formatTimestamp(duration * 1000)}</span>
      </div>
      <div className="player-controls">
        <button type="button" className="skip-btn" aria-label="Back 15 seconds" onClick={() => skip(-15)}>
          −15
        </button>
        <button
          type="button"
          className="play-btn"
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => void toggle()}
        >
          {playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
        </button>
        <button type="button" className="skip-btn" aria-label="Forward 15 seconds" onClick={() => skip(15)}>
          +15
        </button>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
