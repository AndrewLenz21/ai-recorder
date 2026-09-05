import { useToastStore } from "../stores/toast.store";

export function Toast() {
  const toast = useToastStore((state) => state.toast);
  const visible = useToastStore((state) => state.visible);

  if (!toast) {
    return null;
  }

  return (
    <div
      className={`toast fixed bottom-7 left-1/2 z-30 flex min-w-[180px] max-w-[min(320px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-0.5 rounded-app border border-border bg-surface px-4 py-3 opacity-0 shadow-app transition-[opacity,transform] duration-200 ease-app ${
        visible ? "is-open translate-y-0 opacity-100" : "translate-y-2"
      }`}
      role="status"
    >
      <strong className={`text-[13px] font-[650] ${toast.kind === "error" ? "text-[#c74646]" : ""}`}>
        {toast.title}
      </strong>
      {toast.detail ? <span className="text-xs text-muted-foreground">{toast.detail}</span> : null}
    </div>
  );
}
