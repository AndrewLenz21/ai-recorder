import { create } from "zustand";

import type { RecordingEvent } from "@/tauri/types";

type ScreenCaptureStore = {
  lastCapture: Extract<RecordingEvent, { type: "screenCapture" }> | null;
  flashUntil: number;
  setCapture: (event: Extract<RecordingEvent, { type: "screenCapture" }>) => void;
  clearFlash: () => void;
};

export const useScreenCaptureStore = create<ScreenCaptureStore>((set) => ({
  lastCapture: null,
  flashUntil: 0,
  setCapture: (event) => set({ lastCapture: event, flashUntil: Date.now() + 900 }),
  clearFlash: () => set({ flashUntil: 0 }),
}));
