import { useEffect, useRef, useState } from "react";

import { AudioBarsIcon, FilterIcon } from "@/shared/components/icons";
import { usePresence } from "@/shared/hooks/usePresence";

import { FolderGlyph } from "./FolderGlyph";

type Props = {
  showFolders: boolean;
  showRecordings: boolean;
  onChange: (showFolders: boolean, showRecordings: boolean) => void;
};

function Switch({ on }: { on: boolean }) {
  return (
    <span className={`library-switch-control ${on ? "is-on" : ""}`} aria-hidden="true">
      <span className="library-switch-thumb" />
    </span>
  );
}

export function LibraryTypeFilter({ showFolders, showRecordings, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const { present, entered } = usePresence(open);
  const rootRef = useRef<HTMLDivElement>(null);
  const filtered = !showFolders || !showRecordings;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="library-type-menu">
      <button
        type="button"
        className={`library-type-trigger ${filtered ? "is-on" : ""} ${open ? "is-open" : ""}`}
        aria-label="Filter"
        aria-expanded={open}
        aria-haspopup="dialog"
        data-tip="Filter"
        onClick={() => setOpen((value) => !value)}
      >
        <FilterIcon size={15} />
      </button>
      {present ? (
        <div
          className={`library-filter-popover menu-surface ${entered ? "is-open" : ""}`}
          role="dialog"
          aria-label="Show"
        >
          <p className="library-filter-heading">Show</p>
          <button
            type="button"
            className="library-filter-row"
            aria-pressed={showFolders}
            onClick={() => onChange(!showFolders, showRecordings)}
          >
            <span className="folder-mark is-small is-gray">
              <FolderGlyph icon="folder" size={14} />
            </span>
            <span>Folders</span>
            <Switch on={showFolders} />
          </button>
          <button
            type="button"
            className="library-filter-row"
            aria-pressed={showRecordings}
            onClick={() => onChange(showFolders, !showRecordings)}
          >
            <span className="recording-mark is-small">
              <AudioBarsIcon size={14} />
            </span>
            <span>Recordings</span>
            <Switch on={showRecordings} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
