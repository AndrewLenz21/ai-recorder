import { useCallback } from "react";

import { recorderService } from "../services/recorder.service";
import { useRecorderStore } from "../stores/recorder.store";
import { useRecordingClock } from "./useRecordingClock";

export function useRecorder() {
  const status = useRecorderStore((state) => state.status);
  const session = useRecorderStore((state) => state.session);
  const error = useRecorderStore((state) => state.error);
  const viewingSession = useRecorderStore((state) => state.viewingSession);
  const recents = useRecorderStore((state) => state.recents);
  const durationMs = useRecordingClock();

  const run = useCallback(async (action: () => Promise<unknown>) => {
    try {
      await action();
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

  const refreshRecents = useCallback(async () => {
    const list = await recorderService.listSessions();
    useRecorderStore.getState().setRecents(list);
  }, []);

  return {
    status,
    session,
    error,
    viewingSession,
    recents,
    durationMs,
    start: () => run(recorderService.start),
    pause: () => run(recorderService.pause),
    resume: () => run(recorderService.resume),
    stop: () => run(recorderService.stop),
    dismiss: async () => {
      useRecorderStore.getState().setViewingSession(null);
      await run(recorderService.dismiss);
      await refreshRecents();
    },
    openSession: async (id: string) => {
      const recording = await recorderService.getSession(id);
      useRecorderStore.getState().setViewingSession(recording);
    },
    refreshRecents,
  };
}

export function useRecorderView(): "home" | "session" | "summary" {
  const status = useRecorderStore((state) => state.status);
  const viewingSession = useRecorderStore((state) => state.viewingSession);

  if (viewingSession) {
    return "summary";
  }
  if (status === "recording" || status === "paused" || status === "stopping") {
    return "session";
  }
  if (status === "completed") {
    return "summary";
  }
  return "home";
}
