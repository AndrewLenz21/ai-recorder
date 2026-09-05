import { create } from "zustand";

import type { RecordingFolder, SessionSummary } from "@/tauri/types";

import type { LibraryRoute, LibrarySort } from "../types";

type LibraryStore = {
  folders: RecordingFolder[];
  recordings: SessionSummary[];
  route: LibraryRoute;
  sort: LibrarySort;
  defaultFolderId: string | null;
  destinationFolderId: string | null;
  error: string | null;
  setFolders: (folders: RecordingFolder[]) => void;
  setRecordings: (recordings: SessionSummary[]) => void;
  setRoute: (route: LibraryRoute) => void;
  setSort: (sort: LibrarySort) => void;
  setDefaultFolderId: (folderId: string | null) => void;
  setDestinationFolderId: (folderId: string | null) => void;
  setError: (error: string | null) => void;
};

export const useLibraryStore = create<LibraryStore>((set) => ({
  folders: [],
  recordings: [],
  route: { name: "root" },
  sort: "newest",
  defaultFolderId: null,
  destinationFolderId: null,
  error: null,
  setFolders: (folders) => set({ folders }),
  setRecordings: (recordings) => set({ recordings }),
  setRoute: (route) => set({ route }),
  setSort: (sort) => set({ sort }),
  setDefaultFolderId: (defaultFolderId) => set({ defaultFolderId }),
  setDestinationFolderId: (destinationFolderId) => set({ destinationFolderId }),
  setError: (error) => set({ error }),
}));
