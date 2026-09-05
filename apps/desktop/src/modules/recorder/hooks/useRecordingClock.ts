import { useEffect, useState } from "react";

import { useRecorderStore } from "../stores/recorder.store";

export function useRecordingClock(): number {
  const durationMs = useRecorderStore((state) => state.durationMs);
  const status = useRecorderStore((state) => state.status);
  const hydratedAt = useRecorderStore((state) => state.hydratedAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== "recording") {
      return;
    }
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [status]);

  if (status === "recording") {
    return durationMs + Math.max(0, now - hydratedAt);
  }
  return durationMs;
}
