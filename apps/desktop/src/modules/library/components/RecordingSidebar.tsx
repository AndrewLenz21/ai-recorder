import { formatTimestamp } from "@/shared/lib/time";
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
    <aside className={`detail-sidebar ${collapsed ? "is-collapsed" : ""}`} aria-hidden={collapsed}>
      <div className="sidebar-tools">
        <button type="button" className="library-back" onClick={onBack}>
          {backLabel}
        </button>
        <button type="button" className="ghost-link" onClick={onToggle} aria-label="Hide recordings">
          Hide
        </button>
      </div>
      <ul className="sidebar-list">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`sidebar-item ${item.id === selectedId ? "is-active" : ""}`}
              onClick={() => onSelect(item.id)}
            >
              <strong>{recordingTitle(item)}</strong>
              <span>{formatTimestamp(item.durationMs)}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
