import { HoverTip } from "@/shared/components/HoverTip";
import { AudioBarsIcon, CaptureIcon, ChevronRightIcon } from "@/shared/components/icons";
import { formatDateTime, formatTimestamp } from "@/shared/lib/time";
import type { SessionSummary } from "@/tauri/types";

import { recordingTitle } from "../utils/recordings";

type Props = {
  items: SessionSummary[];
  selectedId: string;
  backLabel: string;
  collapsed: boolean;
  onBack: () => void;
  onSelect: (id: string) => void;
  onToggle: () => void;
};

function tipFor(item: SessionSummary) {
  return (
    <>
      {formatDateTime(item.startedAt)} · {formatTimestamp(item.durationMs)}
      {item.screenshotCount > 0 ? (
        <>
          <span className="hover-tip-sep">|</span>
          {item.screenshotCount}
          <CaptureIcon size={12} />
        </>
      ) : null}
    </>
  );
}

function metaFor(item: SessionSummary) {
  return [
    formatTimestamp(item.durationMs),
    item.screenshotCount > 0
      ? `${item.screenshotCount} screenshot${item.screenshotCount === 1 ? "" : "s"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function RecordingSidebar({
  items,
  selectedId,
  backLabel,
  collapsed,
  onBack,
  onSelect,
  onToggle,
}: Props) {
  return (
    <aside className={`detail-sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <div className="library-sidebar-top">
        <button type="button" className="library-back detail-sidebar-copy" onClick={onBack}>
          {backLabel}
        </button>
        <button
          type="button"
          className={`library-sidebar-toggle ${collapsed ? "is-collapsed" : ""}`}
          aria-label={collapsed ? "Expand recordings sidebar" : "Collapse recordings sidebar"}
          onClick={onToggle}
        >
          <ChevronRightIcon size={16} />
        </button>
      </div>

      <p className="folder-field-label detail-sidebar-copy">Recordings</p>

      <ul className="sidebar-list">
        {items.map((item) => {
          const selected = item.id === selectedId;
          return (
            <li key={item.id}>
              <HoverTip label={collapsed ? tipFor(item) : null}>
                <button
                  type="button"
                  className={`detail-nav-item ${selected ? "is-selected" : ""} ${collapsed ? "is-collapsed" : ""}`}
                  onClick={() => onSelect(item.id)}
                >
                  <span className="recording-mark is-small">
                    <AudioBarsIcon size={14} />
                  </span>
                  <span className="detail-nav-copy">
                    <strong>{recordingTitle(item)}</strong>
                    <span>{metaFor(item)}</span>
                  </span>
                </button>
              </HoverTip>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
