import { recorderCommands } from "@/tauri/commands/recorder";

export const recorderService = {
  start: recorderCommands.start,
  setDestination: recorderCommands.setDestination,
  pause: recorderCommands.pause,
  resume: recorderCommands.resume,
  stop: recorderCommands.stop,
  dismiss: recorderCommands.dismiss,
  getState: recorderCommands.state,
  listSessions: recorderCommands.listSessions,
  getSession: recorderCommands.getSession,
};
