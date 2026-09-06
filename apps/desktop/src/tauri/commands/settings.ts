import type { RecordingSession } from "@/tauri/types";

import { invokeCommand } from "./invoke";

export type ProviderCapability = "transcription" | "ai";

export type ProviderConnection = {
  id: string;
  capability: ProviderCapability;
  type: string;
  displayName: string;
  model: string;
  isDefault: boolean;
  baseUrl?: string | null;
  language?: string | null;
  enabledModels: string[];
  hasCredential: boolean;
  credentialHint?: string | null;
};

export type AiModel = {
  id: string;
  name: string;
};

export type LocalModel = {
  id: string;
  label: string;
  filename: string;
  bytes: number;
  installed: boolean;
  recommended: boolean;
};

export type AppSettings = {
  connections: ProviderConnection[];
  localModels: LocalModel[];
};

export const settingsCommands = {
  get: () => invokeCommand<AppSettings>("settings_get"),
  connect: (input: {
    capability: ProviderCapability;
    kind: string;
    displayName: string;
    model: string;
    baseUrl?: string | null;
    language?: string | null;
    apiKey?: string | null;
    enabledModels?: string[];
  }) =>
    invokeCommand<AppSettings>("settings_connect_provider", {
      capability: input.capability,
      kind: input.kind,
      displayName: input.displayName,
      model: input.model,
      baseUrl: input.baseUrl ?? null,
      language: input.language ?? null,
      apiKey: input.apiKey ?? null,
      enabledModels: input.enabledModels ?? [],
    }),
  update: (input: {
    id: string;
    displayName?: string | null;
    model?: string | null;
    baseUrl?: string | null;
    language?: string | null;
    apiKey?: string | null;
    clearApiKey?: boolean;
    enabledModels?: string[];
  }) =>
    invokeCommand<AppSettings>("settings_update_connection", {
      id: input.id,
      displayName: input.displayName ?? null,
      model: input.model ?? null,
      baseUrl: input.baseUrl ?? null,
      language: input.language ?? null,
      apiKey: input.apiKey ?? null,
      clearApiKey: input.clearApiKey ?? false,
      enabledModels: input.enabledModels ?? null,
    }),
  disconnect: (id: string) => invokeCommand<AppSettings>("settings_disconnect_provider", { id }),
  setDefault: (id: string) => invokeCommand<AppSettings>("settings_set_default_provider", { id }),
  test: (id: string) => invokeCommand<void>("settings_test_connection", { id }),
  testCredentials: (input: {
    capability: ProviderCapability;
    kind: string;
    apiKey: string;
    baseUrl?: string | null;
  }) =>
    invokeCommand<void>("settings_test_credentials", {
      capability: input.capability,
      kind: input.kind,
      apiKey: input.apiKey,
      baseUrl: input.baseUrl ?? null,
    }),
  previewAiModels: (kind: string, apiKey: string, baseUrl?: string | null) =>
    invokeCommand<AiModel[]>("settings_preview_ai_models", { kind, apiKey, baseUrl: baseUrl ?? null }),
  refreshAiModels: (id: string) => invokeCommand<AiModel[]>("settings_refresh_ai_models", { id }),
  previewTranscriptionModels: (kind: string, apiKey: string, baseUrl?: string | null) =>
    invokeCommand<AiModel[]>("settings_preview_transcription_models", {
      kind,
      apiKey,
      baseUrl: baseUrl ?? null,
    }),
  refreshTranscriptionModels: (id: string) =>
    invokeCommand<AiModel[]>("settings_refresh_transcription_models", { id }),
  downloadModel: (modelId: string) => invokeCommand<AppSettings>("settings_download_local_model", { modelId }),
  removeModel: (modelId: string) => invokeCommand<AppSettings>("settings_remove_local_model", { modelId }),
  transcribe: (id: string) => invokeCommand<RecordingSession>("recorder_transcribe", { id }),
  generateSummary: (id: string) => invokeCommand<RecordingSession>("recorder_generate_summary", { id }),
  hasSecret: (providerId: string) => invokeCommand<boolean>("credentials_has", { providerId }),
  deleteSecret: (providerId: string) => invokeCommand<void>("credentials_delete", { providerId }),
};
