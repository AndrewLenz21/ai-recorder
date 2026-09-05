import { useCallback, useEffect, useMemo } from "react";

import { recorderService } from "@/modules/recorder/services/recorder.service";
import { useRecorderStore } from "@/modules/recorder/stores/recorder.store";
import type { FolderColor, FolderIcon } from "@/tauri/types";

import { libraryService } from "../services/library.service";
import { useLibraryStore } from "../stores/library.store";
import type { LibraryRoute, LibrarySort } from "../types";
import { sortRecordings } from "../utils/recordings";

function resolvedDefault(folders: { id: string }[], folderId: string | null | undefined) {
  if (!folderId) {
    return null;
  }
  return folders.some((folder) => folder.id === folderId) ? folderId : null;
}

export function useLibrary() {
  const folders = useLibraryStore((state) => state.folders);
  const recordings = useLibraryStore((state) => state.recordings);
  const route = useLibraryStore((state) => state.route);
  const sort = useLibraryStore((state) => state.sort);
  const defaultFolderId = useLibraryStore((state) => state.defaultFolderId);
  const destinationFolderId = useLibraryStore((state) => state.destinationFolderId);
  const error = useLibraryStore((state) => state.error);

  const refresh = useCallback(async () => {
    try {
      const [library, list] = await Promise.all([
        libraryService.get(),
        libraryService.listRecordings(),
      ]);
      const store = useLibraryStore.getState();
      const nextDefault = resolvedDefault(library.folders, library.defaultFolderId);
      const recording = useRecorderStore.getState();
      const live = recording.status === "recording" || recording.status === "paused";
      store.setFolders(library.folders);
      store.setRecordings(list);
      store.setDefaultFolderId(nextDefault);
      if (!live) {
        store.setDestinationFolderId(resolvedDefault(library.folders, store.destinationFolderId) ?? nextDefault);
      } else if (store.destinationFolderId && !library.folders.some((folder) => folder.id === store.destinationFolderId)) {
        store.setDestinationFolderId(null);
      }
      store.setError(null);
    } catch (caught) {
      useLibraryStore.getState().setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  const currentFolder = useMemo(() => {
    if (route.name !== "folder") {
      return null;
    }
    return folders.find((folder) => folder.id === route.folderId) ?? null;
  }, [folders, route]);

  const destinationFolder = useMemo(
    () => folders.find((folder) => folder.id === destinationFolderId) ?? null,
    [folders, destinationFolderId],
  );

  const visibleRecordings = useMemo(() => {
    const filtered =
      route.name === "folder"
        ? recordings.filter((item) => item.folderId === route.folderId)
        : recordings;
    return sortRecordings(filtered, sort);
  }, [recordings, route, sort]);

  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of recordings) {
      if (!item.folderId) {
        continue;
      }
      counts.set(item.folderId, (counts.get(item.folderId) ?? 0) + 1);
    }
    return counts;
  }, [recordings]);

  const run = useCallback(
    async <T>(action: () => Promise<T>): Promise<T | null> => {
      try {
        const result = await action();
        await refresh();
        return result;
      } catch (caught) {
        useLibraryStore.getState().setError(caught instanceof Error ? caught.message : String(caught));
        return null;
      }
    },
    [refresh],
  );

  const setRoute = useCallback((next: LibraryRoute) => {
    useLibraryStore.getState().setRoute(next);
  }, []);

  const setSort = useCallback((next: LibrarySort) => {
    useLibraryStore.getState().setSort(next);
  }, []);

  const setDestination = useCallback(async (folderId: string | null) => {
    useLibraryStore.getState().setDestinationFolderId(folderId);
    const recording = useRecorderStore.getState();
    if (recording.status === "recording" || recording.status === "paused") {
      try {
        await recorderService.setDestination(folderId);
      } catch (caught) {
        useLibraryStore.getState().setError(caught instanceof Error ? caught.message : String(caught));
      }
    }
  }, []);

  return {
    folders,
    recordings,
    visibleRecordings,
    route,
    sort,
    error,
    currentFolder,
    defaultFolderId,
    destinationFolderId,
    destinationFolder,
    folderCounts,
    refresh,
    setRoute,
    setSort,
    setDestination,
    createFolder: (name: string, icon: FolderIcon, color: FolderColor) =>
      run(() => libraryService.createFolder(name, icon, color)),
    updateFolder: (id: string, name: string, icon: FolderIcon, color: FolderColor) =>
      run(() => libraryService.updateFolder(id, name, icon, color)),
    deleteFolder: async (id: string) => {
      const ok = await run(() => libraryService.deleteFolder(id));
      const current = useLibraryStore.getState();
      if (ok && current.route.name === "folder" && current.route.folderId === id) {
        current.setRoute({ name: "root" });
      }
      return ok;
    },
    setDefaultFolder: (folderId: string | null) => run(() => libraryService.setDefaultFolder(folderId)),
    moveRecording: (id: string, folderId: string | null) =>
      run(() => libraryService.moveSession(id, folderId)),
    renameRecording: (id: string, title: string) =>
      run(() => libraryService.renameSession(id, title)),
    deleteRecording: (id: string) => run(() => libraryService.deleteSession(id)),
  };
}

export function useLibraryHydration() {
  const refresh = useLibrary().refresh;

  useEffect(() => {
    void refresh();
  }, [refresh]);
}
