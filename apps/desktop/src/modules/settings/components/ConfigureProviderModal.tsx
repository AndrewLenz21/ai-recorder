import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/shared/components/Button";
import { Modal } from "@/shared/components/Modal";
import { Select } from "@/shared/components/Select";
import {
  AlertIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  GlobeIcon,
  KeyIcon,
  NotesIcon,
  RefreshIcon,
  SparkleIcon,
} from "@/shared/components/icons";
import { showToast } from "@/shared/stores/toast.store";
import type { AiModel, AppSettings, LocalModel, ProviderCapability, ProviderConnection } from "@/tauri/commands/settings";

import {
  CUSTOM_MODEL_VALUE,
  LANGUAGE_OPTIONS,
  catalogItem,
  defaultModelId,
  isCustomCompatible,
  modelSelectOptions,
  type ProviderCatalogItem,
} from "../catalog";
import { settingsService } from "../services/settings.service";
import { AiModelPicker } from "./AiModelPicker";
import { LocalModelList } from "./LocalModelList";

type Progress = { id: string; received: number; total: number };
type TestStatus = { kind: "idle" } | { kind: "testing" } | { kind: "ok" } | { kind: "error"; message: string };

type Props = {
  open: boolean;
  capability: ProviderCapability;
  item: ProviderCatalogItem | null;
  connection?: ProviderConnection | null;
  reuseCredential?: boolean;
  reuseHint?: string | null;
  reuseFrom?: string | null;
  localModels: LocalModel[];
  progress?: Progress | null;
  onClose: () => void;
  onChange: (settings: AppSettings) => void;
};

function ProviderMark({ catalog }: { catalog: ProviderCatalogItem }) {
  return (
    <span className="modal-mark">
      {catalog.type === "local" ? <NotesIcon size={16} /> : catalog.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function ProviderField({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="provider-field">
      <span className="provider-field-label">
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}

export function ConfigureProviderModal({
  open,
  capability,
  item,
  connection,
  reuseCredential = false,
  reuseHint = null,
  reuseFrom = null,
  localModels,
  progress,
  onClose,
  onChange,
}: Props) {
  const catalog = item ?? (connection ? catalogItem(capability, connection.type) : null);
  const [displayName, setDisplayName] = useState("");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [language, setLanguage] = useState("auto");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [replacingKey, setReplacingKey] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>({ kind: "idle" });
  const apiKeyRef = useRef<HTMLInputElement>(null);
  const [discovered, setDiscovered] = useState<AiModel[]>([]);
  const [asrModels, setAsrModels] = useState<AiModel[]>([]);
  const [enabledIds, setEnabledIds] = useState<string[]>([]);
  const [listing, setListing] = useState(false);
  const [manualModel, setManualModel] = useState(false);

  useEffect(() => {
    if (!open || !catalog) {
      return;
    }
    setDisplayName(connection?.displayName ?? catalog.name);
    const known = catalog.models.some((entry) => entry.id === connection?.model);
    if (connection?.model && !known && catalog.allowCustomModel) {
      setModel(CUSTOM_MODEL_VALUE);
      setCustomModel(connection.model);
    } else {
      setModel(connection?.model || (catalog.type === "local" ? "small" : defaultModelId(catalog)));
      setCustomModel("");
    }
    setBaseUrl(connection?.baseUrl ?? "");
    setLanguage(connection?.language ?? "auto");
    setApiKey("");
    setShowKey(false);
    setReplacingKey(false);
    setTestStatus({ kind: "idle" });
    setDiscovered([]);
    setAsrModels(catalog.models.map((entry) => ({ id: entry.id, name: entry.label })));
    setEnabledIds(connection?.enabledModels ?? []);
    setManualModel(false);
  }, [open, catalog, connection]);

  useEffect(() => {
    if (!open || capability !== "ai" || !connection) {
      return;
    }
    setListing(true);
    void settingsService
      .refreshAiModels(connection.id)
      .then((rows) => {
        const available = new Set(rows.map((item) => item.id));
        const kept = (connection.enabledModels ?? []).filter((id) => available.has(id));
        const nextEnabled = kept.length > 0 ? kept : rows.map((item) => item.id);
        setDiscovered(rows);
        setEnabledIds(nextEnabled);
        setModel(nextEnabled.includes(connection.model) ? connection.model : nextEnabled[0] ?? "");
      })
      .catch(() => setManualModel(true))
      .finally(() => setListing(false));
  }, [open, capability, connection?.id]);

  useEffect(() => {
    if (!open || !catalog?.discoverModels || capability !== "transcription" || !connection) {
      return;
    }
    void settingsService
      .refreshTranscriptionModels(connection.id)
      .then((rows) => {
        if (rows.length === 0) {
          return;
        }
        setAsrModels(rows);
        const ids = new Set(rows.map((row) => row.id));
        setModel((current) => (ids.has(current) ? current : rows[0]?.id ?? current));
      })
      .catch(() => undefined);
  }, [open, catalog?.discoverModels, capability, connection?.id]);

  if (!catalog) {
    return null;
  }

  const readApiKey = () => (apiKeyRef.current?.value || apiKey).trim();
  const selectedLocal = localModels.find((entry) => entry.id === model);
  const custom = isCustomCompatible(catalog.type);
  const resolvedModel = model === CUSTOM_MODEL_VALUE ? customModel.trim() : model;
  const aiFlow = capability === "ai";
  const showAiModels = aiFlow && discovered.length > 0 && !manualModel;
  const keySaved = Boolean(connection?.hasCredential || reuseCredential);
  const keyLocked = keySaved && !replacingKey;
  const asrChoices = asrModels.length > 0 ? asrModels : catalog.models.map((entry) => ({ id: entry.id, name: entry.label }));
  const hideModelSelect = !custom && !catalog.allowCustomModel && asrChoices.length <= 1;
  const dialogTitle = catalog.type === "local" ? "Local transcription" : `${connection ? "Configure" : "Connect"} ${catalog.name}`;
  const dialogSubtitle =
    catalog.type === "local"
      ? "Private · No API key · Works offline"
      : `Configure ${catalog.name} for ${capability === "ai" ? "summaries" : "transcription"}.`;

  const applyModels = (rows: AiModel[], previousEnabled?: string[]) => {
    setDiscovered(rows);
    const available = new Set(rows.map((item) => item.id));
    const kept = (previousEnabled ?? rows.map((item) => item.id)).filter((id) => available.has(id));
    const nextEnabled = kept.length > 0 ? kept : rows.slice(0, 1).map((item) => item.id);
    setEnabledIds(nextEnabled);
    const currentDefault = connection?.model || model;
    setModel(nextEnabled.includes(currentDefault) ? currentDefault : nextEnabled[0] ?? "");
  };

  const applyAsrModels = (rows: AiModel[]) => {
    if (rows.length === 0) {
      return;
    }
    setAsrModels(rows);
    const ids = new Set(rows.map((row) => row.id));
    setModel((current) => (ids.has(current) ? current : rows[0]?.id ?? current));
  };

  const toggleModel = (id: string, enabled: boolean) => {
    setEnabledIds((current) => {
      if (enabled) {
        return current.includes(id) ? current : [...current, id];
      }
      if (current.length <= 1) {
        return current;
      }
      const next = current.filter((item) => item !== id);
      if (model === id) {
        setModel(next[0] ?? "");
      }
      return next;
    });
  };

  const persistLocal = async (modelId: string, downloaded?: AppSettings) => {
    setSaving(true);
    try {
      let next = downloaded;
      if (connection) {
        next = await settingsService.update({ id: connection.id, model: modelId, displayName: "Local" });
        if (!connection.isDefault) {
          next = await settingsService.setDefault(connection.id);
        }
      } else {
        next = await settingsService.connect({
          capability,
          kind: "local",
          displayName: "Local",
          model: modelId,
          language: "auto",
        });
        const created = next.connections.find((item) => item.type === "local" && item.model === modelId);
        if (created && !created.isDefault) {
          next = await settingsService.setDefault(created.id);
        }
      }
      onChange(next);
      onClose();
      showToast("success", selectedLocal?.installed ? "Local provider ready" : "Local model ready");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const downloadAndUse = async () => {
    setSaving(true);
    try {
      let next = await settingsService.get();
      const current = next.localModels.find((entry) => entry.id === model);
      if (current && !current.installed) {
        next = await settingsService.downloadModel(model);
        onChange(next);
      }
      await persistLocal(model, next);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : String(error));
      setSaving(false);
    }
  };

  const saveCloud = async () => {
    setSaving(true);
    try {
      const next = connection
        ? await settingsService.update({
            id: connection.id,
            displayName: custom ? displayName : catalog.name,
            model: resolvedModel,
            baseUrl: catalog.needsBaseUrl ? baseUrl : null,
            language: capability === "transcription" ? language : null,
            apiKey: readApiKey() || null,
          })
        : await settingsService.connect({
            capability,
            kind: catalog.type,
            displayName: custom ? displayName : catalog.name,
            model: resolvedModel,
            baseUrl: catalog.needsBaseUrl ? baseUrl : null,
            language: capability === "transcription" ? language : null,
            apiKey: readApiKey() || null,
          });
      const saved = next.connections.find((item) => item.type === catalog.type && item.capability === capability);
      if (catalog.needsKey && saved && !saved.hasCredential) {
        throw new Error("API key could not be saved. Try again.");
      }
      onChange(next);
      onClose();
      showToast("success", connection ? "Provider updated" : "Provider connected");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    const key = readApiKey();
    setTesting(true);
    setTestStatus({ kind: "testing" });
    try {
      if (key) {
        await settingsService.testCredentials({
          capability,
          kind: catalog.type,
          apiKey: key,
          baseUrl: baseUrl || null,
        });
      } else if (connection?.hasCredential) {
        await settingsService.test(connection.id);
      } else if (reuseCredential) {
        await settingsService.testCredentials({
          capability,
          kind: catalog.type,
          apiKey: "",
          baseUrl: baseUrl || null,
        });
      } else {
        throw new Error("Add an API key to test this provider.");
      }
      if (catalog.discoverModels) {
        const rows = connection
          ? await settingsService.refreshTranscriptionModels(connection.id)
          : await settingsService.previewTranscriptionModels(catalog.type, key, baseUrl || null);
        applyAsrModels(rows);
      }
      setTestStatus({ kind: "ok" });
    } catch (error) {
      setTestStatus({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setTesting(false);
    }
  };

  const loadAiModels = async () => {
    setListing(true);
    try {
      const rows = connection
        ? await settingsService.refreshAiModels(connection.id)
        : await settingsService.previewAiModels(catalog.type, readApiKey(), baseUrl || null);
      applyModels(rows, connection?.enabledModels);
    } catch (error) {
      if (custom || catalog.models.length === 0) {
        setManualModel(custom);
      }
      if (catalog.models.length > 0) {
        applyModels(
          catalog.models.map((entry) => ({ id: entry.id, name: entry.label })),
          connection?.enabledModels,
        );
      }
      showToast("error", error instanceof Error ? error.message : String(error));
    } finally {
      setListing(false);
    }
  };

  const saveAi = async () => {
    if (showAiModels && enabledIds.length === 0) {
      showToast("error", "Enable at least one model.");
      return;
    }
    setSaving(true);
    try {
      const next = connection
        ? await settingsService.update({
            id: connection.id,
            displayName: custom ? displayName : catalog.name,
            model: resolvedModel,
            baseUrl: catalog.needsBaseUrl ? baseUrl : null,
            apiKey: readApiKey() || null,
            enabledModels: showAiModels ? enabledIds : connection.enabledModels,
          })
        : await settingsService.connect({
            capability,
            kind: catalog.type,
            displayName: custom ? displayName : catalog.name,
            model: resolvedModel,
            baseUrl: catalog.needsBaseUrl ? baseUrl : null,
            apiKey: readApiKey() || null,
            enabledModels: enabledIds,
          });
      onChange(next);
      onClose();
      showToast("success", connection ? "Provider updated" : "Provider connected");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const disconnect = () => {
    if (!connection) {
      return;
    }
    void settingsService.disconnect(connection.id).then(onChange);
    onClose();
  };

  const apiKeyField = (
    <div className="provider-field">
      <span className="provider-field-label">
        <KeyIcon size={13} />
        API key
      </span>
      {keyLocked ? (
        <div className="provider-secret-saved">
          <div>
            <strong>API key saved securely</strong>
            <span>
              {connection?.credentialHint ?? reuseHint ?? "••••••••••••"}
              {reuseFrom && !connection ? ` · Shared with ${reuseFrom}` : ""}
            </span>
          </div>
          <button type="button" className="provider-secret-replace" onClick={() => setReplacingKey(true)}>
            Replace key
          </button>
        </div>
      ) : (
        <>
          <div className="provider-secret-input">
            <input
              ref={apiKeyRef}
              className="settings-input"
              type={showKey ? "text" : "password"}
              autoComplete="off"
              placeholder={keySaved ? "Paste a new API key" : "Paste API key"}
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value);
                setTestStatus({ kind: "idle" });
              }}
            />
            <button
              type="button"
              className="provider-secret-toggle"
              aria-label={showKey ? "Hide API key" : "Show API key"}
              onClick={() => setShowKey((current) => !current)}
            >
              {showKey ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
            </button>
          </div>
          {keySaved ? (
            <button type="button" className="provider-secret-keep" onClick={() => setReplacingKey(false)}>
              Keep saved key
            </button>
          ) : null}
        </>
      )}
    </div>
  );

  const testButton = (
    <Button
      variant="secondary"
      size="sm"
      className={`provider-test-btn ${testStatus.kind === "ok" ? "is-ok" : testStatus.kind === "error" ? "is-error" : ""}`}
      busy={testing}
      disabled={saving || listing}
      title={testStatus.kind === "error" ? testStatus.message : undefined}
      onClick={() => void test()}
    >
      {testing ? (
        <span className="app-spinner" />
      ) : testStatus.kind === "ok" ? (
        <CheckIcon size={14} />
      ) : testStatus.kind === "error" ? (
        <AlertIcon size={14} />
      ) : (
        <RefreshIcon size={14} />
      )}
      {testing ? "Testing..." : testStatus.kind === "ok" ? "Successful" : testStatus.kind === "error" ? "Failed" : "Test connection"}
    </Button>
  );

  const cloudFooter = (
    <footer className="provider-dialog-footer">
      {connection ? (
        <Button variant="ghost" size="sm" className="provider-dialog-disconnect" onClick={disconnect}>
          Disconnect
        </Button>
      ) : null}
      <div className="provider-dialog-actions">
        <Button variant="primary" size="sm" busy={saving} disabled={testing || !resolvedModel} onClick={() => void saveCloud()}>
          {saving ? <span className="app-spinner" /> : <CheckIcon size={14} />}
          Save provider
        </Button>
        {testButton}
      </div>
    </footer>
  );

  return (
    <Modal
      open={open}
      title={dialogTitle}
      subtitle={dialogSubtitle}
      leading={<ProviderMark catalog={catalog} />}
      onClose={onClose}
    >
      <div className="provider-dialog">
        {catalog.type === "local" ? (
          <>
            <p className="folder-field-label">Available models</p>
            <LocalModelList models={localModels} selectedId={model} selectable progress={progress} onSelect={setModel} />
            <footer className="provider-dialog-footer">
              <div className="provider-dialog-actions">
                {selectedLocal?.installed ? (
                  <Button variant="primary" size="sm" busy={saving} onClick={() => void persistLocal(model)}>
                    {saving ? <span className="app-spinner" /> : <CheckIcon size={14} />}
                    Use as default
                  </Button>
                ) : (
                  <Button variant="primary" size="sm" busy={saving} disabled={!model} onClick={() => void downloadAndUse()}>
                    {saving ? <span className="app-spinner" /> : <CheckIcon size={14} />}
                    Download & Use
                  </Button>
                )}
              </div>
            </footer>
          </>
        ) : aiFlow ? (
          <>
            {custom ? (
              <label className="settings-field">
                <span>Name</span>
                <input className="settings-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </label>
            ) : null}
            {catalog.needsBaseUrl ? (
              <label className="settings-field">
                <span>Base URL</span>
                <input
                  className="settings-input"
                  value={baseUrl}
                  placeholder="https://api.example.com/v1"
                  onChange={(event) => setBaseUrl(event.target.value)}
                />
              </label>
            ) : null}
            {apiKeyField}
            {showAiModels ? (
              <AiModelPicker
                models={discovered}
                enabledIds={enabledIds}
                defaultId={model}
                onToggle={toggleModel}
                onDefault={(id) => setModel(id)}
                onEnableAll={() => setEnabledIds(discovered.map((item) => item.id))}
                onDisableAll={() => {
                  const keep = model || discovered[0]?.id;
                  setEnabledIds(keep ? [keep] : []);
                }}
              />
            ) : null}
            {manualModel ? (
              <label className="settings-field">
                <span>Model ID</span>
                <input className="settings-input" value={resolvedModel} placeholder="provider/model-id" onChange={(event) => setModel(event.target.value)} />
              </label>
            ) : null}
            {listing ? <p className="muted">Loading models…</p> : null}
            <footer className="provider-dialog-footer">
              {connection ? (
                <Button variant="ghost" size="sm" className="provider-dialog-disconnect" onClick={disconnect}>
                  Disconnect
                </Button>
              ) : null}
              <div className="provider-dialog-actions">
                {!showAiModels && !manualModel ? (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      busy={listing}
                      disabled={saving || testing || (!apiKey && !connection && !reuseCredential)}
                      onClick={() => void loadAiModels()}
                    >
                      {listing ? <span className="app-spinner" /> : <CheckIcon size={14} />}
                      Continue
                    </Button>
                    {testButton}
                  </>
                ) : (
                  <>
                    <Button variant="primary" size="sm" busy={saving} disabled={listing || !resolvedModel} onClick={() => void saveAi()}>
                      {saving ? <span className="app-spinner" /> : <CheckIcon size={14} />}
                      Save provider
                    </Button>
                    {connection ? (
                      <Button variant="secondary" size="sm" disabled={listing} onClick={() => void loadAiModels()}>
                        <RefreshIcon size={14} />
                        Refresh models
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            </footer>
          </>
        ) : (
          <>
            {custom ? (
              <ProviderField icon={<SparkleIcon size={13} />} label="Name">
                <input className="settings-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </ProviderField>
            ) : null}
            {custom ? (
              <ProviderField icon={<SparkleIcon size={13} />} label="Model ID">
                <input
                  className="settings-input"
                  value={model === CUSTOM_MODEL_VALUE ? customModel : model}
                  placeholder="provider/model-id"
                  onChange={(event) => setModel(event.target.value)}
                />
              </ProviderField>
            ) : hideModelSelect ? (
              <div className="provider-field">
                <span className="provider-field-label">
                  <SparkleIcon size={13} />
                  Model
                </span>
                <div className="provider-model-row">{asrChoices[0]?.name ?? "GLM-ASR-2512"}</div>
              </div>
            ) : (
              <>
                <ProviderField icon={<SparkleIcon size={13} />} label="Model">
                  <Select
                    ariaLabel="Model"
                    value={model}
                    options={
                      asrChoices.length > 0
                        ? asrChoices.map((entry) => ({ value: entry.id, label: entry.name }))
                        : modelSelectOptions(catalog)
                    }
                    onChange={setModel}
                  />
                </ProviderField>
                {model === CUSTOM_MODEL_VALUE ? (
                  <ProviderField icon={<SparkleIcon size={13} />} label="Custom model ID">
                    <input className="settings-input" value={customModel} placeholder="provider/model-id" onChange={(event) => setCustomModel(event.target.value)} />
                  </ProviderField>
                ) : null}
              </>
            )}
            {catalog.needsBaseUrl ? (
              <ProviderField icon={<GlobeIcon size={13} />} label="Base URL">
                <input
                  className="settings-input"
                  value={baseUrl}
                  placeholder="https://api.example.com/v1"
                  onChange={(event) => setBaseUrl(event.target.value)}
                />
              </ProviderField>
            ) : null}
            <ProviderField icon={<GlobeIcon size={13} />} label="Language">
              <Select ariaLabel="Language" value={language} options={LANGUAGE_OPTIONS} onChange={setLanguage} />
            </ProviderField>
            {apiKeyField}
            {cloudFooter}
          </>
        )}
      </div>
    </Modal>
  );
}
