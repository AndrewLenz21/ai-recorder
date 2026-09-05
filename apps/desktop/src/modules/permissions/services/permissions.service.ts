import { permissionsCommands } from "@/tauri/commands/permissions";

export const permissionsService = {
  status: permissionsCommands.status,
  request: permissionsCommands.request,
  openSettings: permissionsCommands.openSettings,
};
