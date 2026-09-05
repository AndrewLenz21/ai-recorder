import { useEffect, useRef, useState } from "react";

import { usePresence } from "@/shared/hooks/usePresence";
import type { RecordingFolder } from "@/tauri/types";

import { FolderGlyph } from "./FolderGlyph";

type Props = {
  folders: RecordingFolder[];
  currentFolderId?: string | null;
  onMove: (folderId: string | null) => void;
};

export function MoveMenu({ folders, currentFolderId, onMove }: Props) {
  const [open, setOpen] = useState(false);
  const { present, entered } = usePresence(open);
  const rootRef = useRef<HTMLDivElement>(null);

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

  if (folders.length === 0) {
    return null;
  }

  return (
    <div ref={rootRef} className="move-menu">
      <button
        type="button"
        className="move-button"
        aria-label="Move to folder"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        Move
      </button>
      {present ? (
        <div className={`move-popover menu-surface ${entered ? "is-open" : ""}`} role="menu" aria-label="Move to folder">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!currentFolderId}
            className={`move-option ${currentFolderId ? "" : "is-active"}`}
            onClick={(event) => {
              event.stopPropagation();
              onMove(null);
              setOpen(false);
            }}
          >
            All Recordings
          </button>
          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              role="menuitemradio"
              aria-checked={folder.id === currentFolderId}
              className={`move-option ${folder.id === currentFolderId ? "is-active" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                onMove(folder.id);
                setOpen(false);
              }}
            >
              <span className={`folder-mark is-small is-${folder.color}`}>
                <FolderGlyph icon={folder.icon} size={14} />
              </span>
              {folder.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
