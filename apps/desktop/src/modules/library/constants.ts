import type { FolderColor, FolderIcon } from "@/tauri/types";

export const FOLDER_ICONS: { id: FolderIcon; label: string }[] = [
  { id: "folder", label: "Folder" },
  { id: "briefcase", label: "Work" },
  { id: "microphone", label: "Recording" },
  { id: "lightbulb", label: "Ideas" },
  { id: "book", label: "Notes" },
  { id: "code", label: "Code" },
  { id: "people", label: "People" },
  { id: "video", label: "Meetings" },
  { id: "graduation", label: "Learning" },
  { id: "star", label: "Starred" },
  { id: "archive", label: "Archive" },
];

export const FOLDER_COLORS: { id: FolderColor; label: string }[] = [
  { id: "blue", label: "Blue" },
  { id: "purple", label: "Purple" },
  { id: "green", label: "Green" },
  { id: "orange", label: "Orange" },
  { id: "red", label: "Red" },
  { id: "pink", label: "Pink" },
  { id: "teal", label: "Teal" },
  { id: "gray", label: "Gray" },
];

export const SORT_OPTIONS: { id: import("./types").LibrarySort; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "duration", label: "Duration" },
  { id: "size", label: "Size" },
  { id: "name", label: "Name" },
];
