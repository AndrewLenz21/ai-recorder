import { create } from "zustand";

import type { PermissionsStatus } from "@/tauri/types";

type PermissionsStore = {
  status: PermissionsStatus | null;
  setStatus: (status: PermissionsStatus) => void;
};

export const usePermissionsStore = create<PermissionsStore>((set) => ({
  status: null,
  setStatus: (status) => set({ status }),
}));
