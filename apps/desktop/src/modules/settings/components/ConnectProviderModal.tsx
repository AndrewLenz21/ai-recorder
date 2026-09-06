import { useMemo, useState } from "react";

import { Modal } from "@/shared/components/Modal";
import type { ProviderCapability } from "@/tauri/commands/settings";

import { catalogFor, type ProviderCatalogItem } from "../catalog";

type Props = {
  open: boolean;
  capability: ProviderCapability;
  connectedTypes?: string[];
  onClose: () => void;
  onSelect: (item: ProviderCatalogItem) => void;
};

export function ConnectProviderModal({ open, capability, connectedTypes = [], onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const items = catalogFor(capability);
  const filtered = useMemo(() => {
    const available = items.filter(
      (item) => item.type === "openai-compatible" || !connectedTypes.includes(item.type),
    );
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return available;
    }
    return available.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) || item.description.toLowerCase().includes(needle),
    );
  }, [items, query, connectedTypes]);
  const groups = [...new Set(filtered.map((item) => item.group))];

  return (
    <Modal
      open={open}
      title={capability === "transcription" ? "Connect transcription provider" : "Connect AI provider"}
      subtitle="Choose an integration to use with recordings."
      size="picker"
      onClose={onClose}
    >
      <input
        className="settings-input"
        value={query}
        placeholder="Search providers"
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="provider-picker">
        {groups.map((group) => (
          <section key={group}>
            <p className="provider-picker-label">{group}</p>
            {filtered
              .filter((item) => item.group === group)
              .map((item) => (
                <button
                  key={item.type}
                  type="button"
                  className="provider-picker-row"
                  onClick={() => onSelect(item)}
                >
                  <strong>{item.name}</strong>
                  <span>{item.description}</span>
                </button>
              ))}
          </section>
        ))}
        {filtered.length === 0 ? <p className="muted">No providers match that search.</p> : null}
      </div>
    </Modal>
  );
}
