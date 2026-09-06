import { CheckIcon, DownloadIcon } from "@/shared/components/icons";
import { formatBytes } from "@/shared/lib/time";
import type { LocalModel } from "@/tauri/commands/settings";

import { LOCAL_MODEL_BLURBS } from "../catalog";

type Progress = { id: string; received: number; total: number };

type Props = {
  models: LocalModel[];
  selectedId?: string;
  progress?: Progress | null;
  selectable?: boolean;
  busyId?: string | null;
  onSelect?: (id: string) => void;
  onDownload?: (id: string) => void;
  onUse?: (id: string) => void;
  onRemove?: (id: string) => void;
};

export function LocalModelList({
  models,
  selectedId,
  progress,
  selectable = false,
  busyId,
  onSelect,
  onDownload,
  onUse,
}: Props) {
  return (
    <ul className="model-row-list">
      {models.map((model) => {
        const downloading = progress?.id === model.id && !model.installed;
        const percent =
          downloading && progress.total > 0 ? Math.min(100, Math.round((progress.received / progress.total) * 100)) : 0;
        return (
          <li key={model.id}>
            <div className={`model-row ${selectable && selectedId === model.id ? "is-selected" : ""}`}>
              {selectable ? (
                <button type="button" className="model-row-main" onClick={() => onSelect?.(model.id)}>
                  <span className={`model-radio ${selectedId === model.id ? "is-on" : ""}`} />
                  <span className="model-row-copy">
                    <strong>Whisper {model.label}</strong>
                    <span>
                      {LOCAL_MODEL_BLURBS[model.id] ?? ""}
                      {LOCAL_MODEL_BLURBS[model.id] ? " · " : ""}
                      {formatBytes(model.bytes)}
                      {model.recommended ? " · Recommended" : ""}
                      {model.installed ? " · Installed" : ""}
                    </span>
                  </span>
                </button>
              ) : (
                <div className="model-row-copy">
                  <strong>Whisper {model.label}</strong>
                  <span>
                    {formatBytes(model.bytes)}
                    {model.recommended ? " · Recommended" : ""}
                    {model.installed ? " · Installed" : ""}
                  </span>
                </div>
              )}
              <div className="model-row-actions">
                {downloading ? (
                  <span className="model-download-progress" aria-label={`Downloading ${percent}%`}>
                    <svg viewBox="0 0 32 32" aria-hidden="true">
                      <circle cx="16" cy="16" r="13" />
                      <circle
                        cx="16"
                        cy="16"
                        r="13"
                        style={{ strokeDashoffset: 81.68 - (81.68 * percent) / 100 }}
                      />
                    </svg>
                  </span>
                ) : model.installed ? (
                  <button
                    type="button"
                    className="model-download is-ready"
                    aria-label={onUse ? "Use as default" : "Downloaded"}
                    disabled={!onUse}
                    onClick={() => onUse?.(model.id)}
                  >
                    <CheckIcon size={16} />
                    <span>{onUse ? "Use as default" : "Downloaded"}</span>
                  </button>
                ) : onDownload ? (
                  <button
                    type="button"
                    className="model-download"
                    aria-label="Download"
                    disabled={busyId === model.id}
                    onClick={() => onDownload(model.id)}
                  >
                    <DownloadIcon size={16} />
                    <span>Download</span>
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
