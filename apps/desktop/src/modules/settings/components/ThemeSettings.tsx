import { THEMES } from "@/app/theme/theme";
import { useTheme } from "@/app/theme/useTheme";

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="settings-panel">
      <header className="settings-panel-head">
        <h2>Theme</h2>
        <p>Uses the same theme as the rest of the app.</p>
      </header>
      <div className="settings-theme-list" role="radiogroup" aria-label="Theme">
        {THEMES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`settings-theme-item ${item.id === theme ? "is-active" : ""}`}
            role="radio"
            aria-checked={item.id === theme}
            onClick={() => setTheme(item.id)}
          >
            <span className="settings-theme-swatch" style={{ background: item.swatch }} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
