import type { MeetingSnapshot } from "@/tauri/types";
import { invokeCommand } from "./invoke";

export const meetingDetectionCommands = {
  snapshot: () => invokeCommand<MeetingSnapshot>("meeting_detection_snapshot"),
};
