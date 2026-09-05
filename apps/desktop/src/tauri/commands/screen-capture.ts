import type { RecordingEvent } from "@/tauri/types";
import { invokeCommand } from "./invoke";

export const screenCaptureCommands = {
  take: () => invokeCommand<RecordingEvent>("screen_capture_take"),
};
