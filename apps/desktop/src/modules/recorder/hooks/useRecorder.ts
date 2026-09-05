import { useCallback } from "react";

import { useLibraryStore } from "@/modules/library/stores/library.store";
import { showToast } from "@/shared/stores/toast.store";

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
      return true;
    } catch (caught) {
      const current = useRecorderStore.getState();
      current.hydrate({
        status: current.status,
        session: current.session,
        durationMs: current.durationMs,
        error: caught instanceof Error ? caught.message : String(caught),
      });
      return false;
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
    start: () => run(() => recorderService.start(useLibraryStore.getState().destinationFolderId)),
    pause: () => run(recorderService.pause),
    resume: () => run(recorderService.resume),
    stop: async () => {
      const ok = await run(recorderService.stop);
      if (!ok) {
        showToast("error", "Recording could not be saved.");
      }
      return ok;
    },
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
