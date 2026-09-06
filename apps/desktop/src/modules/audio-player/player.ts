import { create } from "zustand";

export type PlayerTrack = {
  id: string;
  src: string;
  label: string;
};

type AudioPlayerState = {
  src: string | null;
  tracks: PlayerTrack[];
  muted: Record<string, boolean>;
  playing: boolean;
  currentTime: number;
  duration: number;
  ready: boolean;
  error: string | null;
};

const idle: AudioPlayerState = {
  src: null,
  tracks: [],
  muted: {},
  playing: false,
  currentTime: 0,
  duration: 0,
  ready: false,
  error: null,
};

export const useAudioPlayerStore = create<AudioPlayerState>(() => ({ ...idle }));

const elements = new Map<string, HTMLAudioElement>();
let clock: number | null = null;

function primaryElement() {
  const { tracks } = useAudioPlayerStore.getState();
  for (const track of tracks) {
    const node = elements.get(track.id);
    if (node) {
      return node;
    }
  }
  return elements.values().next().value ?? null;
}

function syncFrom(audio: HTMLAudioElement | null = primaryElement()) {
  if (!audio) {
    return;
  }
  const duration = Number.isFinite(audio.duration) && audio.duration > 0
    ? audio.duration
    : useAudioPlayerStore.getState().duration;
  useAudioPlayerStore.setState({
    playing: !audio.paused && !audio.ended,
    currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
    duration,
    ready: audio.readyState >= 1,
  });
}

function stopClock() {
  if (clock != null) {
    window.cancelAnimationFrame(clock);
    clock = null;
  }
}

function startClock() {
  stopClock();
  const tick = () => {
    const audio = primaryElement();
    if (!audio || audio.paused || audio.ended) {
      syncFrom(audio);
      clock = null;
      return;
    }
    syncFrom(audio);
    const time = audio.currentTime;
    for (const node of elements.values()) {
      if (node === audio) {
        continue;
      }
      if (Math.abs(node.currentTime - time) > 0.035) {
        node.currentTime = time;
      }
    }
    clock = window.requestAnimationFrame(tick);
  };
  clock = window.requestAnimationFrame(tick);
}

function bind(audio: HTMLAudioElement) {
  audio.preload = "metadata";
  audio.addEventListener("timeupdate", () => syncFrom(audio));
  audio.addEventListener("loadedmetadata", () => syncFrom(audio));
  audio.addEventListener("durationchange", () => syncFrom(audio));
  audio.addEventListener("play", () => {
    startClock();
    syncFrom(audio);
  });
  audio.addEventListener("pause", () => {
    stopClock();
    syncFrom(audio);
  });
  audio.addEventListener("ended", () => {
    stopClock();
    syncFrom(audio);
  });
  audio.addEventListener("error", () => {
    useAudioPlayerStore.setState({
      playing: false,
      error: "This recording could not be played.",
    });
  });
}

function applyMute() {
  const muted = useAudioPlayerStore.getState().muted;
  for (const [id, audio] of elements) {
    audio.muted = Boolean(muted[id]);
    audio.volume = muted[id] ? 0 : 1;
  }
}

function clearElements() {
  stopClock();
  for (const audio of elements.values()) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  elements.clear();
}

export function loadTracks(tracks: PlayerTrack[], durationHint = 0) {
  const key = tracks.map((track) => `${track.id}:${track.src}`).join("|");
  const current = useAudioPlayerStore.getState().tracks.map((track) => `${track.id}:${track.src}`).join("|");
  if (key && key === current && elements.size === tracks.length) {
    return;
  }
  clearElements();
  const muted: Record<string, boolean> = {};
  for (const track of tracks) {
    const audio = new Audio();
    bind(audio);
    audio.src = track.src;
    audio.load();
    elements.set(track.id, audio);
    muted[track.id] = false;
  }
  useAudioPlayerStore.setState({
    src: tracks[0]?.src ?? null,
    tracks,
    muted,
    playing: false,
    currentTime: 0,
    duration: durationHint,
    ready: false,
    error: tracks.length ? null : "This recording has no audio.",
  });
}

export function loadAudio(src: string, durationHint = 0) {
  loadTracks([{ id: "mixed", src, label: "Audio" }], durationHint);
}

export async function playAudio() {
  applyMute();
  const time = useAudioPlayerStore.getState().currentTime;
  try {
    await Promise.all(
      [...elements.values()].map(async (audio) => {
        if (Number.isFinite(time)) {
          audio.currentTime = time;
        }
        await audio.play();
      }),
    );
    startClock();
    syncFrom();
  } catch {
    useAudioPlayerStore.setState({ error: "Playback was interrupted." });
  }
}

export function pauseAudio() {
  for (const audio of elements.values()) {
    audio.pause();
  }
  stopClock();
  syncFrom();
}

export function toggleAudio() {
  const audio = primaryElement();
  if (!audio || audio.paused) {
    void playAudio();
  } else {
    pauseAudio();
  }
}

export function seekAudio(seconds: number) {
  const duration = useAudioPlayerStore.getState().duration;
  const audio = primaryElement();
  const next = Math.min(Math.max(seconds, 0), duration || audio?.duration || 0);
  if (!Number.isFinite(next)) {
    return;
  }
  for (const node of elements.values()) {
    node.currentTime = next;
  }
  useAudioPlayerStore.setState({ currentTime: next });
}

export function skipAudio(deltaSeconds: number) {
  seekAudio(useAudioPlayerStore.getState().currentTime + deltaSeconds);
}

export function setTrackMuted(id: string, muted: boolean) {
  useAudioPlayerStore.setState((state) => ({
    muted: { ...state.muted, [id]: muted },
  }));
  applyMute();
}

export function toggleTrack(id: string) {
  const muted = Boolean(useAudioPlayerStore.getState().muted[id]);
  setTrackMuted(id, !muted);
}

export function unloadAudio() {
  clearElements();
  useAudioPlayerStore.setState({ ...idle });
}
