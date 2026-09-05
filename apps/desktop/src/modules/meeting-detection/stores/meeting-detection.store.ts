import { create } from "zustand";

import type { MeetingSnapshot } from "@/tauri/types";

type MeetingDetectionStore = {
  snapshot: MeetingSnapshot | null;
  setSnapshot: (snapshot: MeetingSnapshot) => void;
};

export const useMeetingDetectionStore = create<MeetingDetectionStore>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
}));
