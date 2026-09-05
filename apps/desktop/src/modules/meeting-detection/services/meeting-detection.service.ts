import { meetingDetectionCommands } from "@/tauri/commands/meeting-detection";

export const meetingDetectionService = {
  snapshot: meetingDetectionCommands.snapshot,
};
