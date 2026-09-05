import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
};

const FOCUSABLE = "input, button, textarea, select, [tabindex]:not([tabindex='-1'])";

function motionMs() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200;
}

export function Modal({ open, title, subtitle, className = "", onClose, children }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [present, setPresent] = useState(open);
  const [entered, setEntered] = useState(false);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      setPresent(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setEntered(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }
    setEntered(false);
    const timer = window.setTimeout(() => setPresent(false), motionMs());
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!present || !entered) {
      return;
    }
    const panel = panelRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTarget =
      panel?.querySelector<HTMLElement>("input, textarea, select") ??
      panel?.querySelector<HTMLElement>(FOCUSABLE);
    focusTarget?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) {
        return;
      }
      const nodes = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (node) => !node.hasAttribute("disabled"),
      );
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) {
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [present, entered]);

  if (!present) {
    return null;
  }

  return createPortal(
    <div
      className={`modal-backdrop ${entered ? "is-open" : ""}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        className={`modal-panel ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 className="modal-title" id={titleId}>
          {title}
        </h2>
        {subtitle ? <p className="modal-subtitle">{subtitle}</p> : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
