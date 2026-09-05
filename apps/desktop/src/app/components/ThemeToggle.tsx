import { useEffect, useRef, useState } from "react";

import { usePresence } from "@/shared/hooks/usePresence";

import { THEMES, themeMeta } from "../theme/theme";
import { useTheme } from "../theme/useTheme";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const { present, entered } = usePresence(open);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = themeMeta(theme);

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
    <div ref={rootRef} className="theme-toggle fixed top-3 right-3.5 z-4">
      <button
        type="button"
        className="theme-toggle-button inline-flex min-h-8 items-center gap-2 rounded-full border border-border bg-surface py-0 pr-2.5 pl-2 text-xs font-semibold text-foreground backdrop-blur-[20px]"
        aria-label="Choose theme"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span
          className="size-3 shrink-0 rounded-full border border-border shadow-[inset_0_0_0_1px_oklch(0_0_0/0.08)]"
          style={{ background: current.swatch }}
        />
        <span>{current.label}</span>
      </button>
      {present ? (
        <div
          className={`theme-menu menu-surface absolute top-[calc(100%+8px)] right-0 flex min-w-[148px] flex-col gap-0.5 rounded-app border border-border bg-surface p-1.5 shadow-app backdrop-blur-[24px] ${entered ? "is-open" : ""}`}
          role="menu"
          aria-label="Themes"
        >
          {THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitemradio"
              aria-checked={item.id === theme}
              className={`inline-flex min-h-8 w-full items-center gap-2 rounded-[10px] border-0 px-2.5 text-left text-[13px] text-foreground backdrop-blur-[20px] hover:bg-border ${item.id === theme ? "bg-border" : "bg-transparent"}`}
              onClick={() => {
                setTheme(item.id);
                setOpen(false);
              }}
            >
              <span
                className="size-3 shrink-0 rounded-full border border-border shadow-[inset_0_0_0_1px_oklch(0_0_0/0.08)]"
                style={{ background: item.swatch }}
              />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
