import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import { GearIcon, NotesIcon, PlusIcon, SparkleIcon } from "@/shared/components/icons";
import { showToast } from "@/shared/stores/toast.store";
import type { AppSettings, ProviderCapability, ProviderConnection } from "@/tauri/commands/settings";

import { providerModelLabel, type ProviderCatalogItem } from "../catalog";
import { settingsService } from "../services/settings.service";
import { ConfigureProviderModal } from "./ConfigureProviderModal";
import { ConnectProviderModal } from "./ConnectProviderModal";
import { LocalModelList } from "./LocalModelList";

type Props = {
  capability: ProviderCapability;
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
};

type Progress = { id: string; received: number; total: number };

export function ProviderManager({ capability, settings, onChange }: Props) {
  const connections = settings.connections.filter((item) => item.capability === capability);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState<ProviderCatalogItem | null>(null);
  const [editing, setEditing] = useState<ProviderConnection | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const unlisten = listen<Progress>("settings:model-progress", (event) => {
      setProgress(event.payload);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const run = async (label: string, action: () => Promise<AppSettings>) => {
    try {
      onChange(await action());
      showToast("success", label);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : String(error));
    }
  };

  const catalogType = draft?.type ?? editing?.type;
  const sibling = catalogType
    ? settings.connections.find(
        (item) =>
          item.type === catalogType &&
          item.type !== "openai-compatible" &&
          item.hasCredential &&
          item.id !== editing?.id,
      )
    : undefined;

  const useLocal = async (modelId: string) => {
    const existing = connections.find((item) => item.type === "local");
    try {
      let next = existing
        ? await settingsService.update({ id: existing.id, model: modelId, displayName: "Local" })
        : await settingsService.connect({
            capability: "transcription",
            kind: "local",
            displayName: "Local",
            model: modelId,
            language: "auto",
          });
      const local = next.connections.find((item) => item.type === "local");
      if (local && !local.isDefault) {
        next = await settingsService.setDefault(local.id);
      }
      onChange(next);
      showToast("success", "Local transcription is ready");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="settings-panel">
      <header className="settings-panel-head">
        <div className="settings-panel-title">
          <h2>{capability === "transcription" ? "Transcription" : "AI Provider"}</h2>
          <button type="button" className="settings-connect" onClick={() => setPickerOpen(true)}>
            <PlusIcon size={14} />
            Connect provider
          </button>
        </div>
        <p>
          {capability === "transcription"
            ? "Connect providers, then choose a default for new transcriptions."
            : "Connect providers, then choose a default for summaries."}
        </p>
      </header>

      <p className="folder-field-label">Connected providers</p>
      {connections.length === 0 ? (
        <div className="settings-empty">
          <span className="settings-empty-mark">
            {capability === "ai" ? <SparkleIcon size={16} /> : <NotesIcon size={16} />}
          </span>
          <h3>No providers connected</h3>
          <p>
            {capability === "ai"
              ? "Connect an AI provider to enable summaries."
              : "Connect a transcription provider to turn recordings into text."}
          </p>
        </div>
      ) : (
        <ul className="provider-card-list">
          {connections.map((connection) => {
            const localModel = settings.localModels.find((item) => item.id === connection.model);
            const subtitle =
              connection.type === "local"
                ? `Whisper ${localModel?.label ?? connection.model}`
                : providerModelLabel(capability, connection.type, connection.model);
            const meta =
              connection.type === "local"
                ? "Private · Offline"
                : connection.hasCredential
                  ? "Connected"
                  : "Needs API key";
            return (
              <li key={connection.id} className="provider-card is-compact">
                <div className="provider-card-copy">
                  <strong>
                    {connection.displayName}
                    {connection.isDefault ? <span className="provider-badge">Default</span> : null}
                  </strong>
                  <p>
                    {subtitle} · {meta}
                  </p>
                </div>
                <div className="model-row-actions">
                  <button
                    type="button"
                    className="model-download"
                    aria-label="Manage"
                    onClick={() => setEditing(connection)}
                  >
                    <GearIcon size={16} />
                    <span>Manage</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {capability === "transcription" ? (
        <div>
          <p className="folder-field-label">Local models</p>
          <LocalModelList
            models={settings.localModels}
            progress={progress}
            busyId={busyId}
            onDownload={(id) => {
              setBusyId(id);
              void settingsService
                .downloadModel(id)
                .then(onChange)
                .catch((error) => showToast("error", error instanceof Error ? error.message : String(error)))
                .finally(() => {
                  setBusyId(null);
                  setProgress(null);
                });
            }}
            onUse={(id) => void useLocal(id)}
            onRemove={(id) => void run("Model removed", () => settingsService.removeModel(id))}
          />
        </div>
      ) : null}

      <ConnectProviderModal
        open={pickerOpen}
        capability={capability}
        connectedTypes={connections.map((item) => item.type)}
        onClose={() => setPickerOpen(false)}
        onSelect={(item) => {
          setPickerOpen(false);
          setDraft(item);
        }}
      />
      <ConfigureProviderModal
        open={Boolean(draft) || Boolean(editing)}
        capability={capability}
        item={draft}
        connection={editing}
        reuseCredential={Boolean(sibling)}
        reuseHint={sibling?.credentialHint}
        reuseFrom={sibling ? (sibling.capability === "transcription" ? "transcription" : "AI") : null}
        localModels={settings.localModels}
        progress={progress}
        onClose={() => {
          setDraft(null);
          setEditing(null);
        }}
        onChange={onChange}
      />
    </div>
  );
}
