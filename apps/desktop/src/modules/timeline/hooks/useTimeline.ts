import { useRecorderStore } from "@/modules/recorder/stores/recorder.store";
import type { RecordingEvent } from "@/tauri/types";

export function useTimeline(): RecordingEvent[] {
  const live = useRecorderStore((state) => state.session?.events ?? []);
  const viewing = useRecorderStore((state) => state.viewingSession?.events);
  return viewing ?? live;
}
