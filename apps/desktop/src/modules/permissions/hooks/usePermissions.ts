import { useCallback, useEffect } from "react";

import { permissionsService } from "../services/permissions.service";
import { usePermissionsStore } from "../stores/permissions.store";

export function usePermissions() {
  const status = usePermissionsStore((state) => state.status);

  const refresh = useCallback(async () => {
    const next = await permissionsService.status();
    usePermissionsStore.getState().setStatus(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const request = useCallback(async (kind: "microphone" | "screen") => {
    const next = await permissionsService.request(kind);
    usePermissionsStore.getState().setStatus(next);
    if (kind === "screen" && next.screenRecording !== "granted") {
      await permissionsService.openSettings("screen");
    }
    if (kind === "microphone" && next.microphone === "denied") {
      await permissionsService.openSettings("microphone");
    }
  }, []);

  return { status, refresh, request };
}
