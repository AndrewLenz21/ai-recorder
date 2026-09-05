import type { FolderColor, FolderIcon } from "@/tauri/types";

export type LibraryRoute =
  | { name: "root" }
  | { name: "all" }
  | { name: "storage" }
  | { name: "folder"; folderId: string };

export type LibrarySection = "root" | "all" | "storage";

export type LibrarySort = "newest" | "oldest" | "duration" | "size" | "name";

export type FolderDraft = {
  name: string;
  icon: FolderIcon;
  color: FolderColor;
};
