import { create } from "zustand";

type AudioPlayerState = {
  src: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  ready: boolean;
  error: string | null;
};

const idle: AudioPlayerState = {
  src: null,
  playing: false,
  currentTime: 0,
  duration: 0,
  ready: false,
  error: null,
};

export const useAudioPlayerStore = create<AudioPlayerState>(() => ({ ...idle }));

let element: HTMLAudioElement | null = null;

function sync() {
  if (!element) {
    return;
  }
  const duration = Number.isFinite(element.duration) && element.duration > 0
    ? element.duration
    : useAudioPlayerStore.getState().duration;
  useAudioPlayerStore.setState({
    playing: !element.paused && !element.ended,
    currentTime: Number.isFinite(element.currentTime) ? element.currentTime : 0,
    duration,
    ready: element.readyState >= 1,
  });
}

function getAudio() {
  if (!element) {
    element = new Audio();
    element.preload = "metadata";
    element.addEventListener("timeupdate", sync);
    element.addEventListener("loadedmetadata", sync);
    element.addEventListener("durationchange", sync);
    element.addEventListener("play", sync);
    element.addEventListener("pause", sync);
    element.addEventListener("ended", sync);
    element.addEventListener("error", () => {
      useAudioPlayerStore.setState({
        playing: false,
        error: "This recording could not be played.",
      });
    });
  }
  return element;
}

export function loadAudio(src: string, durationHint = 0) {
  const audio = getAudio();
  if (useAudioPlayerStore.getState().src === src && audio.src) {
    return;
  }
  audio.pause();
  audio.src = src;
  audio.load();
  useAudioPlayerStore.setState({
    src,
    playing: false,
    currentTime: 0,
    duration: durationHint,
    ready: false,
    error: null,
  });
}

export async function playAudio() {
  try {
    await getAudio().play();
    sync();
  } catch {
    useAudioPlayerStore.setState({ error: "Playback was interrupted." });
  }
}

export function pauseAudio() {
  getAudio().pause();
  sync();
}

export function toggleAudio() {
  const audio = getAudio();
  if (audio.paused) {
    void playAudio();
  } else {
    pauseAudio();
  }
}

export function seekAudio(seconds: number) {
  const audio = getAudio();
  const duration = useAudioPlayerStore.getState().duration;
  const next = Math.min(Math.max(seconds, 0), duration || audio.duration || 0);
  if (!Number.isFinite(next)) {
    return;
  }
  audio.currentTime = next;
  useAudioPlayerStore.setState({ currentTime: next });
}

export function skipAudio(deltaSeconds: number) {
  seekAudio(useAudioPlayerStore.getState().currentTime + deltaSeconds);
}

export function unloadAudio() {
  if (!element) {
    useAudioPlayerStore.setState({ ...idle });
    return;
  }
  element.pause();
  element.removeAttribute("src");
  element.load();
  useAudioPlayerStore.setState({ ...idle });
}
