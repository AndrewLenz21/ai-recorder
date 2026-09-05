import { useEffect, useState } from "react";

import { formatBytes, formatSpan } from "@/shared/lib/time";
import type { StorageStats } from "@/tauri/types";

import { libraryService } from "../services/library.service";
import { useLibrary } from "../hooks/useLibrary";

export function StorageView() {
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
    <section className="library library-storage">
      <header className="flex flex-col items-center gap-2.5 px-0 pt-5 pb-2 text-center">
        <p className="eyebrow">Local Storage</p>
        <h1 className="text-[clamp(28px,5vw,40px)]">{formatBytes(used)}</h1>
        <p className="dashboard-summary">
          {count} recording{count === 1 ? "" : "s"}
          {count > 0 ? ` · ${formatSpan(duration)}` : ""}
        </p>
      </header>
      {error ? <p className="error-text">{error}</p> : null}
      {stats ? (
        <dl className="flex flex-col">
          <div className="flex justify-between gap-4 border-b border-border py-3">
            <dt className="text-[13px] text-muted-foreground">Audio</dt>
            <dd className="m-0 text-[13px] tabular-nums">{formatBytes(stats.audioBytes)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-border py-3">
            <dt className="text-[13px] text-muted-foreground">Screenshots</dt>
            <dd className="m-0 text-[13px] tabular-nums">{formatBytes(stats.screenshotBytes)}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
