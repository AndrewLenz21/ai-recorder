import { useEffect, useRef, useState } from "react";

import { THEMES, themeMeta } from "../theme/theme";
import { useTheme } from "../theme/useTheme";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
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
    <div ref={rootRef} className="theme-toggle">
      <button
        type="button"
        className="theme-toggle-button"
        aria-label="Choose theme"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="theme-swatch" style={{ background: current.swatch }} />
        <span>{current.label}</span>
      </button>
      {open ? (
        <div className="theme-menu" role="menu" aria-label="Themes">
          {THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitemradio"
              aria-checked={item.id === theme}
              className={`theme-option ${item.id === theme ? "is-active" : ""}`}
              onClick={() => {
                setTheme(item.id);
                setOpen(false);
              }}
            >
              <span className="theme-swatch" style={{ background: item.swatch }} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
