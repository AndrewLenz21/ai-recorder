import { recorderCommands } from "@/tauri/commands/recorder";

export const recorderService = {
  start: recorderCommands.start,
  pause: recorderCommands.pause,
  resume: recorderCommands.resume,
  stop: recorderCommands.stop,
  dismiss: recorderCommands.dismiss,
  getState: recorderCommands.state,
  listSessions: recorderCommands.listSessions,
  getSession: recorderCommands.getSession,
};
