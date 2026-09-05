import { useMemo } from "react";

import {
  loadAudio,
  pauseAudio,
  playAudio,
  seekAudio,
  skipAudio,
  toggleAudio,
  unloadAudio,
  useAudioPlayerStore,
} from "../player";

export function useAudioPlayer() {
  const src = useAudioPlayerStore((state) => state.src);
  const playing = useAudioPlayerStore((state) => state.playing);
  const currentTime = useAudioPlayerStore((state) => state.currentTime);
  const duration = useAudioPlayerStore((state) => state.duration);
  const ready = useAudioPlayerStore((state) => state.ready);
  const error = useAudioPlayerStore((state) => state.error);

  return useMemo(
    () => ({
      src,
      playing,
      currentTime,
      duration,
      ready,
      error,
      load: loadAudio,
      play: playAudio,
      pause: pauseAudio,
      toggle: toggleAudio,
      seek: seekAudio,
      skip: skipAudio,
      unload: unloadAudio,
    }),
    [src, playing, currentTime, duration, ready, error],
  );
}
