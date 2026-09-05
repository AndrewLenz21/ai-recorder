import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/shared/components/Button";
import { Modal } from "@/shared/components/Modal";
import { EllipsisIcon } from "@/shared/components/icons";
import { usePresence } from "@/shared/hooks/usePresence";
import type { SessionSummary } from "@/tauri/types";

import { useLibrary } from "../hooks/useLibrary";
import { recordingTitle } from "../utils/recordings";
import { FolderDestinationRow } from "./FolderDestinationRow";
import { FolderGlyph } from "./FolderGlyph";
import { RecordingActionsContent } from "./RecordingActionsContent";

type Props = {
  recording: SessionSummary;
};

const COMPACT = "(max-width: 640px)";
const MENU_WIDTH = 180;

function useCompact() {
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT).matches);

  useEffect(() => {
    const media = window.matchMedia(COMPACT);
    const onChange = () => setCompact(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return compact;
}

function menuPosition(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  const height = 128;
  let top = rect.bottom + 6;
  let left = rect.right - MENU_WIDTH;
  left = Math.min(Math.max(8, left), window.innerWidth - MENU_WIDTH - 8);
  if (top + height > window.innerHeight - 8) {
    top = Math.max(8, rect.top - height - 6);
  }
  return { top, left };
}

export function RecordingOptions({ recording }: Props) {
  const compact = useCompact();
  const { folders, folderCounts, moveRecording, renameRecording, deleteRecording } = useLibrary();
  const [menuOpen, setMenuOpen] = useState(false);
  const { present, entered } = usePresence(menuOpen && !compact);
  const [panel, setPanel] = useState<"move" | "rename" | "delete" | null>(null);
  const [title, setTitle] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen || compact) {
      return;
    }
    if (triggerRef.current) {
      setCoords(menuPosition(triggerRef.current));
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>(".folder-action")?.focus();
    });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, compact]);

  const openPanel = (next: "move" | "rename" | "delete") => {
    closeMenu();
    if (next === "rename") {
      setTitle(recording.title?.trim() || recordingTitle(recording));
    }
    setPanel(next);
  };

  return (
    <div className={`recording-options ${menuOpen ? "is-open" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="icon-btn recording-more"
        aria-label="Recording options"
        aria-haspopup={compact ? "dialog" : "menu"}
        aria-expanded={menuOpen}
        onClick={(event) => {
          event.stopPropagation();
          setMenuOpen((value) => !value);
        }}
      >
        <EllipsisIcon size={16} />
      </button>

      {present
        ? createPortal(
            <div
              ref={menuRef}
              className={`folder-actions-popover menu-surface ${entered ? "is-open" : ""}`}
              role="menu"
              aria-label="Recording options"
              style={{ top: coords.top, left: coords.left }}
            >
              <RecordingActionsContent
                onMove={() => openPanel("move")}
                onRename={() => openPanel("rename")}
                onDelete={() => openPanel("delete")}
              />
            </div>,
            document.body,
          )
        : null}

      {compact ? (
        <Modal open={menuOpen} title="Recording options" onClose={closeMenu}>
          <p className="folder-actions-subtitle">{recordingTitle(recording)}</p>
          <RecordingActionsContent
            onMove={() => openPanel("move")}
            onRename={() => openPanel("rename")}
            onDelete={() => openPanel("delete")}
          />
          <button type="button" className="folder-actions-cancel" onClick={closeMenu}>
            Cancel
          </button>
        </Modal>
      ) : null}

      <Modal
        open={panel === "move"}
        title="Move to"
        subtitle="Choose where this recording should be saved."
        size="picker"
        onClose={() => setPanel(null)}
      >
        <div className="flex max-h-[min(360px,50vh)] flex-col gap-0.5 overflow-y-auto">
          <FolderDestinationRow
            title="All Recordings"
            subtitle="Default library"
            selected={!recording.folderId}
            onClick={() => {
              void moveRecording(recording.id, null);
              setPanel(null);
            }}
          >
            <span className="folder-mark is-gray">
              <FolderGlyph icon="all" />
            </span>
          </FolderDestinationRow>
          {folders.map((folder) => {
            const count = folderCounts.get(folder.id) ?? 0;
            return (
              <FolderDestinationRow
                key={folder.id}
                title={folder.name}
                subtitle={count === 1 ? "1 recording" : `${count} recordings`}
                selected={folder.id === recording.folderId}
                onClick={() => {
                  void moveRecording(recording.id, folder.id);
                  setPanel(null);
                }}
              >
                <span className={`folder-mark is-${folder.color}`}>
                  <FolderGlyph icon={folder.icon} />
                </span>
              </FolderDestinationRow>
            );
          })}
        </div>
      </Modal>

      <Modal open={panel === "rename"} title="Rename recording" onClose={() => setPanel(null)}>
        <form
          className="folder-editor is-dialog"
          onSubmit={(event) => {
            event.preventDefault();
            void renameRecording(recording.id, title);
            setPanel(null);
          }}
        >
          <input
            className="folder-name-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Recording name"
            maxLength={80}
          />
          <div className="folder-editor-actions">
            <Button type="button" variant="ghost" size="sm" onClick={() => setPanel(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={title.trim().length === 0}>
              Rename
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={panel === "delete"} title="Delete recording?" onClose={() => setPanel(null)}>
        <p className="folder-actions-subtitle">
          This will remove the audio, screenshots, and recording metadata.
        </p>
        <div className="folder-editor-actions">
          <Button type="button" variant="ghost" size="sm" onClick={() => setPanel(null)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="danger-btn"
            onClick={() => {
              void deleteRecording(recording.id);
              setPanel(null);
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
