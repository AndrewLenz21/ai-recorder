import { formatDateTime } from "@/shared/lib/time";
import type { SessionSummary } from "@/tauri/types";

import type { LibrarySort } from "../types";

export function recordingTitle(item: { title?: string | null; startedAt: string }): string {
  const title = item.title?.trim();
  return title || formatDateTime(item.startedAt);
}

export function sortRecordings(items: SessionSummary[], sort: LibrarySort): SessionSummary[] {
  const next = [...items];
  next.sort((left, right) => {
    switch (sort) {
      case "oldest":
        return left.startedAt.localeCompare(right.startedAt);
      case "duration":
        return right.durationMs - left.durationMs;
      case "size":
        return right.fileSizeBytes - left.fileSizeBytes;
      case "name":
        return recordingTitle(left).localeCompare(recordingTitle(right), undefined, {
          sensitivity: "base",
        });
      default:
        return right.startedAt.localeCompare(left.startedAt);
    }
  });
  return next;
}
