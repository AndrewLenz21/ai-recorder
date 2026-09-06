import { useEffect, useState } from "react";

import { ProviderManager } from "./ProviderManager";
import { StorageSettings } from "./StorageSettings";
import { ThemeSettings } from "./ThemeSettings";
import { useSettings } from "../hooks/useSettings";

type Section = "storage" | "transcription" | "ai" | "theme";

const NAV: { id: Section; label: string }[] = [
  { id: "storage", label: "Storage" },
  { id: "transcription", label: "Transcription" },
  { id: "ai", label: "AI Provider" },
  { id: "theme", label: "Theme" },
];

export function SettingsView() {
  const { settings, error, loading, setSettings } = useSettings();
  const [section, setSection] = useState<Section>("storage");

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem("ai-recorder.settings-section");
      if (stored === "transcription" || stored === "ai" || stored === "theme" || stored === "storage") {
        setSection(stored);
        window.sessionStorage.removeItem("ai-recorder.settings-section");
      }
    } catch {
      // Ignore private-mode storage errors.
    }
  }, []);

  return (
    <section className="settings-shell">
      <nav className="settings-nav" aria-label="Settings">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`settings-nav-item ${section === item.id ? "is-active" : ""}`}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="settings-main">
        {section === "storage" ? <StorageSettings /> : null}
        {section === "theme" ? <ThemeSettings /> : null}
        {section === "transcription" || section === "ai" ? (
          loading ? (
            <p className="muted">Loading settings…</p>
          ) : error ? (
            <p className="error-text">{error}</p>
          ) : settings ? (
            <ProviderManager capability={section === "ai" ? "ai" : "transcription"} settings={settings} onChange={setSettings} />
          ) : null
        ) : null}
      </div>
    </section>
  );
}
