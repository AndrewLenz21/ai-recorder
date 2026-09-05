import { create } from "zustand";

import type { RecorderStateDto, RecordingSession, SessionSummary } from "@/tauri/types";

type RecorderStore = RecorderStateDto & {
  hydratedAt: number;
  viewingSession: RecordingSession | null;
  recents: SessionSummary[];
  hydrate: (state: RecorderStateDto) => void;
  setViewingSession: (session: RecordingSession | null) => void;
  setRecents: (recents: SessionSummary[]) => void;
};

const idle: RecorderStateDto = {
  status: "idle",
  session: null,
  durationMs: 0,
  error: null,
};

export const useRecorderStore = create<RecorderStore>((set) => ({
  ...idle,
  hydratedAt: Date.now(),
  viewingSession: null,
  recents: [],
  hydrate: (state) => set({ ...state, hydratedAt: Date.now() }),
  setViewingSession: (viewingSession) => set({ viewingSession }),
  setRecents: (recents) => set({ recents }),
}));
