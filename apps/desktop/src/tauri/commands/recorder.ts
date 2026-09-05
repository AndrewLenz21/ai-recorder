import type { RecorderStateDto, RecordingSession, SessionSummary } from "@/tauri/types";
import { invokeCommand } from "./invoke";

export const recorderCommands = {
  start: (folderId?: string | null) =>
    invokeCommand<RecorderStateDto>("recorder_start", { folderId: folderId ?? null }),
  setDestination: (folderId: string | null) =>
    invokeCommand<RecorderStateDto>("recorder_set_destination", { folderId }),
  pause: () => invokeCommand<RecorderStateDto>("recorder_pause"),
  resume: () => invokeCommand<RecorderStateDto>("recorder_resume"),
  stop: () => invokeCommand<RecorderStateDto>("recorder_stop"),
  dismiss: () => invokeCommand<RecorderStateDto>("recorder_dismiss"),
  state: () => invokeCommand<RecorderStateDto>("recorder_state"),
  listSessions: () => invokeCommand<SessionSummary[]>("recorder_list_sessions"),
  getSession: (id: string) => invokeCommand<RecordingSession>("recorder_get_session", { id }),
};
