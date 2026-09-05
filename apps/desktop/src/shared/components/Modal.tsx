import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  size?: "default" | "picker";
  onClose: () => void;
  children: ReactNode;
};

const FOCUSABLE = "input, button, textarea, select, [tabindex]:not([tabindex='-1'])";

function motionMs() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200;
}

export function Modal({ open, title, subtitle, size = "default", onClose, children }: Props) {
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
      className={`modal-backdrop fixed inset-0 z-20 grid place-items-center bg-[oklch(0.12_0.02_260/0.42)] p-4 transition-opacity duration-200 ease-app ${entered ? "is-open opacity-100" : "opacity-0"}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        className={`modal-panel rounded-[18px] border border-border bg-surface opacity-0 shadow-app transition-[opacity,transform] duration-200 ease-app ${
          size === "picker"
            ? "w-[min(440px,calc(100vw-32px))] px-4 pt-[18px] pb-3"
            : "w-[min(480px,calc(100vw-32px))] px-5 pt-5 pb-4"
        } ${entered ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-[0.985]"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2
          className={`modal-title text-[17px] font-[590] tracking-[-0.03em] text-foreground ${subtitle ? "mb-1" : "mb-4"}`}
          id={titleId}
        >
          {title}
        </h2>
        {subtitle ? <p className="modal-subtitle mb-3.5 text-[13px] leading-[1.4] text-muted-foreground">{subtitle}</p> : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
