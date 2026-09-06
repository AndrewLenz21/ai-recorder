import { useMemo, useState } from "react";

import { Button } from "@/shared/components/Button";
import { StarIcon } from "@/shared/components/icons";
import type { AiModel } from "@/tauri/commands/settings";

type Props = {
  models: AiModel[];
  enabledIds: string[];
  defaultId: string;
  onToggle: (id: string, enabled: boolean) => void;
  onDefault: (id: string) => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
};

export function AiModelPicker({
  models,
  enabledIds,
  defaultId,
  onToggle,
  onDefault,
  onEnableAll,
  onDisableAll,
}: Props) {
  const [query, setQuery] = useState("");
  const [enabledOnly, setEnabledOnly] = useState(false);
  const enabled = new Set(enabledIds);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return models.filter((model) => {
      if (enabledOnly && !enabled.has(model.id)) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return model.name.toLowerCase().includes(needle) || model.id.toLowerCase().includes(needle);
    });
  }, [models, query, enabledOnly, enabledIds]);

  return (
    <div className="model-picker">
      <div className="model-picker-head">
        <p className="folder-field-label">Models available</p>
        <span className="muted">{models.length} found</span>
      </div>
      <input
        className="settings-input"
        value={query}
        placeholder="Search models…"
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="model-picker-tools">
        <Button variant="ghost" size="sm" onClick={onEnableAll}>
          Enable all
        </Button>
        <Button variant="ghost" size="sm" onClick={onDisableAll}>
          Disable all
        </Button>
        <label className="model-picker-filter">
          <input type="checkbox" checked={enabledOnly} onChange={(event) => setEnabledOnly(event.target.checked)} />
          Enabled only
        </label>
      </div>
      <ul className="model-picker-list">
        {filtered.map((model) => {
          const on = enabled.has(model.id);
          const isDefault = model.id === defaultId;
          return (
            <li key={model.id} className={`model-pick-row ${on ? "is-on" : ""}`}>
              <div className="model-pick-copy">
                <strong>
                  {model.name}
                  {isDefault ? <span className="provider-badge">Default</span> : null}
                </strong>
                <span>{model.id}</span>
              </div>
              <div className="model-pick-actions">
                {on ? (
                  <button
                    type="button"
                    className={`model-star ${isDefault ? "is-on" : ""}`}
                    aria-label={isDefault ? "Default model" : "Set as default"}
                    onClick={() => onDefault(model.id)}
                  >
                    <StarIcon size={12} />
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`app-toggle ${on ? "is-on" : ""}`}
                  role="switch"
                  aria-checked={on}
                  aria-label={`Enable ${model.name}`}
                  onClick={() => onToggle(model.id, !on)}
                />
              </div>
            </li>
          );
        })}
        {filtered.length === 0 ? <li className="muted">No models match that search.</li> : null}
      </ul>
    </div>
  );
}
