import { libraryCommands } from "@/tauri/commands/library";
import { recorderCommands } from "@/tauri/commands/recorder";

export const libraryService = {
  get: libraryCommands.get,
  storageStats: libraryCommands.storageStats,
  createFolder: libraryCommands.createFolder,
  updateFolder: libraryCommands.updateFolder,
  deleteFolder: libraryCommands.deleteFolder,
  setDefaultFolder: libraryCommands.setDefaultFolder,
  renameSession: libraryCommands.renameSession,
  moveSession: libraryCommands.moveSession,
  deleteSession: libraryCommands.deleteSession,
  listRecordings: recorderCommands.listSessions,
};
