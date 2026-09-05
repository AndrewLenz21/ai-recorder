import { useEffect } from "react";

import { useRecorderStore } from "@/modules/recorder/stores/recorder.store";

import { meetingDetectionService } from "../services/meeting-detection.service";
import { useMeetingDetectionStore } from "../stores/meeting-detection.store";

export function useMeetingDetection() {
  const snapshot = useMeetingDetectionStore((state) => state.snapshot);
  const status = useRecorderStore((state) => state.status);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const next = await meetingDetectionService.snapshot();
        if (!cancelled) {
          useMeetingDetectionStore.getState().setSnapshot(next);
        }
      } catch {
        // Window metadata can fail without screen permission; keep the last snapshot.
      }
    };

    void refresh();
    const interval =
      status === "recording" || status === "paused"
        ? window.setInterval(() => void refresh(), 15000)
        : undefined;

    return () => {
      cancelled = true;
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [status]);

  return snapshot;
}
