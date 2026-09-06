import type { FolderColor, FolderIcon } from "@/tauri/types";

export type LibraryRoute =
  | { name: "root" }
  | { name: "all" }
  | { name: "settings" }
  | { name: "folder"; folderId: string };

export type LibrarySection = "root" | "all" | "settings";

export type LibrarySort = "newest" | "oldest" | "duration" | "size" | "name";

export type FolderDraft = {
  name: string;
  icon: FolderIcon;
  color: FolderColor;
};
