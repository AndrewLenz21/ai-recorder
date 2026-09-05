import type { LibrarySnapshot, RecordingFolder, RecordingSession, StorageStats } from "@/tauri/types";
import { invokeCommand } from "./invoke";

export const libraryCommands = {
  get: () => invokeCommand<LibrarySnapshot>("library_get"),
  storageStats: () => invokeCommand<StorageStats>("library_storage_stats"),
  createFolder: (name: string, icon: string, color: string) =>
    invokeCommand<RecordingFolder>("library_create_folder", { name, icon, color }),
  updateFolder: (id: string, name: string, icon: string, color: string) =>
    invokeCommand<RecordingFolder>("library_update_folder", { id, name, icon, color }),
  deleteFolder: (id: string) => invokeCommand<LibrarySnapshot>("library_delete_folder", { id }),
  setDefaultFolder: (folderId: string | null) =>
    invokeCommand<LibrarySnapshot>("library_set_default_folder", { folderId }),
  renameSession: (id: string, title: string) =>
    invokeCommand<RecordingSession>("recorder_rename_session", { id, title }),
  moveSession: (id: string, folderId: string | null) =>
    invokeCommand<RecordingSession>("recorder_move_session", { id, folderId }),
  deleteSession: (id: string) => invokeCommand<void>("recorder_delete_session", { id }),
};
