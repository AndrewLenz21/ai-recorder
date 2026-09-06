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
  removeModel: settingsCommands.removeModel,
  transcribe: settingsCommands.transcribe,
  generateSummary: settingsCommands.generateSummary,
  hasSecret: settingsCommands.hasSecret,
  deleteSecret: settingsCommands.deleteSecret,
};
