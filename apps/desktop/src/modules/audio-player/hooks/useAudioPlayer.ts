import { useMemo } from "react";

import {
  loadAudio,
  loadTracks,
  pauseAudio,
  playAudio,
  seekAudio,
  setTrackMuted,
  skipAudio,
  toggleAudio,
  toggleTrack,
  unloadAudio,
  useAudioPlayerStore,
} from "../player";

export function useAudioPlayer() {
  const src = useAudioPlayerStore((state) => state.src);
  const tracks = useAudioPlayerStore((state) => state.tracks);
  const muted = useAudioPlayerStore((state) => state.muted);
  const playing = useAudioPlayerStore((state) => state.playing);
  const currentTime = useAudioPlayerStore((state) => state.currentTime);
  const duration = useAudioPlayerStore((state) => state.duration);
  const ready = useAudioPlayerStore((state) => state.ready);
  const error = useAudioPlayerStore((state) => state.error);

  return useMemo(
    () => ({
      src,
      tracks,
      muted,
      playing,
      currentTime,
      duration,
      ready,
      error,
      load: loadAudio,
      loadTracks,
      play: playAudio,
      pause: pauseAudio,
      toggle: toggleAudio,
      seek: seekAudio,
      skip: skipAudio,
      setTrackMuted,
      toggleTrack,
      unload: unloadAudio,
    }),
    [src, tracks, muted, playing, currentTime, duration, ready, error],
  );
}
