import { settingsCommands } from "@/tauri/commands/settings";

export const settingsService = {
  get: settingsCommands.get,
  connect: settingsCommands.connect,
  update: settingsCommands.update,
  disconnect: settingsCommands.disconnect,
  setDefault: settingsCommands.setDefault,
  test: settingsCommands.test,
  testCredentials: settingsCommands.testCredentials,
  previewAiModels: settingsCommands.previewAiModels,
  refreshAiModels: settingsCommands.refreshAiModels,
  previewTranscriptionModels: settingsCommands.previewTranscriptionModels,
  refreshTranscriptionModels: settingsCommands.refreshTranscriptionModels,
  downloadModel: settingsCommands.downloadModel,
  downloadRuntime: settingsCommands.downloadRuntime,
  removeModel: settingsCommands.removeModel,
  transcribe: settingsCommands.transcribe,
  restoreTranscript: settingsCommands.restoreTranscript,
  generateSummary: settingsCommands.generateSummary,
  hasSecret: settingsCommands.hasSecret,
  deleteSecret: settingsCommands.deleteSecret,
};
