import { createPortal } from "react-dom";

import { useToastStore } from "../stores/toast.store";
import { CheckIcon } from "./icons";

function AlertMark() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M12 8.2v5.4M12 16.9v.3" strokeLinecap="round" />
      <path d="M12 4.6 20.4 18.8H3.6L12 4.6Z" strokeLinejoin="round" />
    </svg>
  );
}

export function Toast() {
  const toast = useToastStore((state) => state.toast);
  const visible = useToastStore((state) => state.visible);
  const hide = useToastStore((state) => state.hide);

  if (!toast) {
    return null;
  }

  return createPortal(
    <div
      className={`app-toast ${toast.kind === "error" ? "is-error" : "is-success"} ${visible ? "is-open" : ""}`}
      role="status"
      onClick={() => hide()}
    >
      <span className="app-toast-mark">{toast.kind === "error" ? <AlertMark /> : <CheckIcon size={14} />}</span>
      <div className="app-toast-copy">
        <strong>{toast.title}</strong>
        {toast.detail ? <span>{toast.detail}</span> : null}
      </div>
      <i key={toast.id} className="app-toast-life" />
    </div>,
    document.body,
  );
}
