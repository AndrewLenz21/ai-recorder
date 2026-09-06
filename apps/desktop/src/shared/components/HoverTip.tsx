import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { usePresence } from "@/shared/hooks/usePresence";

type Props = {
  label: ReactNode;
  children: ReactNode;
};

export function HoverTip({ label, children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const { present, entered } = usePresence(open, 160);
  const enabled = Boolean(label);

  useEffect(() => {
    if (!hovered || !enabled) {
      setOpen(false);
      return;
    }
    const timer = window.setTimeout(() => setOpen(true), 300);
    return () => window.clearTimeout(timer);
  }, [hovered, enabled]);

  useEffect(() => {
    if (!open || !rootRef.current) {
      return;
    }
    const rect = rootRef.current.getBoundingClientRect();
    const left = Math.min(rect.right + 10, window.innerWidth - 12);
    const top = Math.min(Math.max(12, rect.top + rect.height / 2), window.innerHeight - 12);
    setCoords({ top, left });
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="hover-tip-anchor"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {children}
      {present
        ? createPortal(
            <div
              className={`hover-tip ${entered ? "is-open" : ""}`}
              role="tooltip"
              style={{ top: coords.top, left: coords.left }}
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
