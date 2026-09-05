import { useEffect, useRef, useState } from "react";

import { usePresence } from "@/shared/hooks/usePresence";

import { SORT_OPTIONS } from "../constants";
import type { LibrarySort } from "../types";

type Props = {
  value: LibrarySort;
  onChange: (value: LibrarySort) => void;
};

export function SortMenu({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const { present, entered } = usePresence(open);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = SORT_OPTIONS.find((item) => item.id === value) ?? SORT_OPTIONS[0] ?? {
    id: "newest" as const,
    label: "Newest",
  };

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
    <div ref={rootRef} className="sort-menu">
      <button
        type="button"
        className="sort-button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        {current.label}
      </button>
      {present ? (
        <div className={`sort-popover menu-surface ${entered ? "is-open" : ""}`} role="menu" aria-label="Sort recordings">
          {SORT_OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitemradio"
              aria-checked={item.id === value}
              className={`sort-option ${item.id === value ? "is-active" : ""}`}
              onClick={() => {
                onChange(item.id);
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
