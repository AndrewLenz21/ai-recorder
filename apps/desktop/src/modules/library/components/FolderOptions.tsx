import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Modal } from "@/shared/components/Modal";
import { EllipsisIcon } from "@/shared/components/icons";
import { usePresence } from "@/shared/hooks/usePresence";
import type { RecordingFolder } from "@/tauri/types";

import { FolderActionsContent } from "./FolderActionsContent";

type Props = {
  folder: RecordingFolder;
  isDefault: boolean;
  onEdit: () => void;
  onSetDefault: () => void;
};

const COMPACT = "(max-width: 640px)";
const MENU_WIDTH = 196;

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
  const height = 96;
  let top = rect.bottom + 6;
  let left = rect.right - MENU_WIDTH;
  left = Math.min(Math.max(8, left), window.innerWidth - MENU_WIDTH - 8);
  if (top + height > window.innerHeight - 8) {
    top = Math.max(8, rect.top - height - 6);
  }
  return { top, left };
}

export function FolderOptions({ folder, isDefault, onEdit, onSetDefault }: Props) {
  const compact = useCompact();
  const [open, setOpen] = useState(false);
  const { present, entered } = usePresence(open && !compact);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open || compact) {
      return;
    }
    const anchor = triggerRef.current;
    if (anchor) {
      setCoords(menuPosition(anchor));
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    };
    const onReposition = () => {
      if (triggerRef.current) {
        setCoords(menuPosition(triggerRef.current));
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>(".folder-action")?.focus();
    });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, compact]);

  const runEdit = () => {
    close();
    onEdit();
  };

  const runDefault = () => {
    close();
    onSetDefault();
  };

  return (
    <div className={`folder-options ${open ? "is-open" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="icon-btn folder-more"
        aria-label="Folder options"
        aria-haspopup={compact ? "dialog" : "menu"}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
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
              aria-label={`${folder.name} options`}
              style={{ top: coords.top, left: coords.left }}
            >
              <FolderActionsContent isDefault={isDefault} onEdit={runEdit} onSetDefault={runDefault} />
            </div>,
            document.body,
          )
        : null}

      {compact ? (
        <Modal open={open} title="Folder options" onClose={close}>
          <p className="folder-actions-subtitle">{folder.name}</p>
          <FolderActionsContent isDefault={isDefault} onEdit={runEdit} onSetDefault={runDefault} />
          <button type="button" className="folder-actions-cancel" onClick={close}>
            Cancel
          </button>
        </Modal>
      ) : null}
    </div>
  );
}
