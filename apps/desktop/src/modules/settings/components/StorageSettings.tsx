import { useEffect, useState } from "react";

import { libraryService } from "@/modules/library/services/library.service";
import { useLibrary } from "@/modules/library/hooks/useLibrary";
import { formatBytes, formatSpan } from "@/shared/lib/time";
import type { StorageStats } from "@/tauri/types";

export function StorageSettings() {
  const { recordings, error } = useLibrary();
  const [stats, setStats] = useState<StorageStats | null>(null);

  useEffect(() => {
    let active = true;
    void libraryService.storageStats().then((next) => {
      if (active) {
        setStats(next);
      }
    });
    return () => {
      active = false;
    };
  }, [recordings.length]);

  const used = stats?.usedBytes ?? recordings.reduce((sum, item) => sum + item.fileSizeBytes, 0);
  const count = stats?.recordingCount ?? recordings.length;
  const duration = stats?.durationMs ?? recordings.reduce((sum, item) => sum + item.durationMs, 0);

  return (
    <div className="settings-panel">
      <header className="settings-panel-head">
        <h2>Storage</h2>
        <p>Local files stay on this computer. Nothing is uploaded unless you run transcription or summary.</p>
      </header>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="settings-stat">
        <strong>{formatBytes(used)}</strong>
        <span>
          {count} recording{count === 1 ? "" : "s"}
          {count > 0 ? ` · ${formatSpan(duration)}` : ""}
        </span>
      </div>
      <dl className="settings-rows">
        <div>
          <dt>Recordings</dt>
          <dd>{count}</dd>
        </div>
        <div>
          <dt>Total duration</dt>
          <dd>{count > 0 ? formatSpan(duration) : "—"}</dd>
        </div>
        <div>
          <dt>Audio</dt>
          <dd>{stats ? formatBytes(stats.audioBytes) : "—"}</dd>
        </div>
        <div>
          <dt>Screenshots</dt>
          <dd>{stats ? formatBytes(stats.screenshotBytes) : "—"}</dd>
        </div>
      </dl>
      <div className="settings-future">
        <p>Storage cleanup</p>
        <span>Delete recordings, clear screenshots, and clear local cache will live here.</span>
      </div>
    </div>
  );
}
