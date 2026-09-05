import { useEffect, useRef, useState } from "react";

import { usePresence } from "@/shared/hooks/usePresence";

import { useLibrary } from "../hooks/useLibrary";
import { FolderGlyph } from "./FolderGlyph";

type Props = {
  compact?: boolean;
};

export function DestinationPicker({ compact = false }: Props) {
  const { folders, destinationFolderId, destinationFolder, setDestination } = useLibrary();
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
    <div ref={rootRef} className={`destination-picker ${compact ? "is-compact" : ""}`}>
      <button
        type="button"
        className="destination-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="destination-label">Saving to</span>
        {destinationFolder ? (
          <span className={`folder-mark is-small is-${destinationFolder.color}`}>
            <FolderGlyph icon={destinationFolder.icon} size={14} />
          </span>
        ) : (
          <span className="folder-mark is-small is-gray">
            <FolderGlyph icon="all" size={14} />
          </span>
        )}
        <span>{destinationFolder?.name ?? "All Recordings"}</span>
      </button>
      {present ? (
        <div className={`destination-menu menu-surface ${entered ? "is-open" : ""}`} role="menu" aria-label="Recording destination">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!destinationFolderId}
            className={`destination-option ${destinationFolderId ? "" : "is-active"}`}
            onClick={() => {
              void setDestination(null);
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
              aria-checked={folder.id === destinationFolderId}
              className={`destination-option ${folder.id === destinationFolderId ? "is-active" : ""}`}
              onClick={() => {
                void setDestination(folder.id);
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
