import { useCallback } from "react";

import { useRecorderStore } from "@/modules/recorder/stores/recorder.store";

import { screenCaptureService } from "../services/screen-capture.service";
import { useScreenCaptureStore } from "../stores/screen-capture.store";

export function useScreenCapture() {
  const take = useCallback(async () => {
    try {
      const event = await screenCaptureService.take();
      if (event.type === "screenCapture") {
        useScreenCaptureStore.getState().setCapture(event);
      }
    } catch (caught) {
      const current = useRecorderStore.getState();
      current.hydrate({
        status: current.status,
        session: current.session,
        durationMs: current.durationMs,
        error: caught instanceof Error ? caught.message : String(caught),
      });
    }
  }, []);

  return { take };
}
