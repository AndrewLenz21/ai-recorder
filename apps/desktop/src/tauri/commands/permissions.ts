import type { PermissionsStatus } from "@/tauri/types";
import { invokeCommand } from "./invoke";

export const permissionsCommands = {
  status: () => invokeCommand<PermissionsStatus>("permissions_status"),
  request: (kind: "microphone" | "screen") =>
    invokeCommand<PermissionsStatus>("permissions_request", { kind }),
  openSettings: (kind: "microphone" | "screen") =>
    invokeCommand<void>("permissions_open_settings", { kind }),
};
