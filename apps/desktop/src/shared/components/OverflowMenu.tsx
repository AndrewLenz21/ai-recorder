import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { usePresence } from "@/shared/hooks/usePresence";

import { EllipsisIcon } from "./icons";
import { Modal } from "./Modal";

export type OverflowItem = {
  id: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  onSelect: () => void;
};

type Props = {
  label: string;
  items: OverflowItem[];
};

const COMPACT = "(max-width: 640px)";
const MENU_WIDTH = 220;

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

function menuPosition(anchor: HTMLElement, count: number) {
  const height = Math.max(48, count * 38 + 12);
  const rect = anchor.getBoundingClientRect();
  let top = rect.bottom + 6;
  let left = rect.right - MENU_WIDTH;
  left = Math.min(Math.max(8, left), window.innerWidth - MENU_WIDTH - 8);
  if (top + height > window.innerHeight - 8) {
    top = Math.max(8, rect.top - height - 6);
  }
  return { top, left };
}

export function OverflowMenu({ label, items }: Props) {
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
    if (triggerRef.current) {
      setCoords(menuPosition(triggerRef.current, items.length));
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
        setCoords(menuPosition(triggerRef.current, items.length));
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
  }, [open, compact, items.length]);

  if (items.length === 0) {
    return null;
  }

  const run = (item: OverflowItem) => {
    if (item.disabled) {
      return;
    }
    close();
    item.onSelect();
  };

  const actions = (
    <div className="folder-actions">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className="folder-action"
          disabled={item.disabled}
          onClick={() => run(item)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className={`detail-tab-menu ${open ? "is-open" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="detail-more"
        aria-label={label}
        aria-haspopup={compact ? "dialog" : "menu"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <EllipsisIcon size={16} />
      </button>

      {present
        ? createPortal(
            <div
              ref={menuRef}
              className={`folder-actions-popover menu-surface ${entered ? "is-open" : ""}`}
              role="menu"
              aria-label={label}
              style={{ top: coords.top, left: coords.left, width: MENU_WIDTH }}
            >
              {actions}
            </div>,
            document.body,
          )
        : null}

      {compact ? (
        <Modal open={open} title={label} onClose={close}>
          {actions}
          <button type="button" className="folder-actions-cancel" onClick={close}>
            Cancel
          </button>
        </Modal>
      ) : null}
    </div>
  );
}
