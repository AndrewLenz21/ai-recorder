import type { RecordingFolder } from "@/tauri/types";

export function isRootFolder(folder: RecordingFolder) {
  return !folder.parentId;
}

export function childFolders(folders: RecordingFolder[], parentId: string | null) {
  return folders.filter((folder) => (folder.parentId ?? null) === parentId);
}

export function folderPath(folders: RecordingFolder[], folderId: string) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const path: RecordingFolder[] = [];
  const seen = new Set<string>();
  let current = byId.get(folderId);

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return path;
}
