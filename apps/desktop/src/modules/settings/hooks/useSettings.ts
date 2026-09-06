import { useCallback, useEffect, useState } from "react";

import type { AppSettings } from "@/tauri/commands/settings";

import { settingsService } from "../services/settings.service";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await settingsService.get();
      setSettings(next);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { settings, error, loading, setSettings, refresh };
}
