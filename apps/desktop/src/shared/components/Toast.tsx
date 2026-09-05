import { useToastStore } from "../stores/toast.store";

export function Toast() {
  const toast = useToastStore((state) => state.toast);
  const visible = useToastStore((state) => state.visible);

  if (!toast) {
    return null;
  }

  return (
    <div className={`toast ${toast.kind} ${visible ? "is-open" : ""}`} role="status">
      <strong>{toast.title}</strong>
      {toast.detail ? <span>{toast.detail}</span> : null}
    </div>
  );
}
