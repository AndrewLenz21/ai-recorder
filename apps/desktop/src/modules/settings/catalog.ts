import type { ProviderCapability } from "@/tauri/commands/settings";

export type ProviderModel = {
  id: string;
  label: string;
  recommended?: boolean;
};

export type ProviderCatalogItem = {
  type: string;
  name: string;
  description: string;
  group: string;
  needsKey: boolean;
  needsBaseUrl: boolean;
  allowCustomModel?: boolean;
  discoverModels?: boolean;
  hidden?: boolean;
  models: ProviderModel[];
};

export const CUSTOM_MODEL_VALUE = "__custom__";

export const TRANSCRIPTION_PROVIDERS: ProviderCatalogItem[] = [
  {
    type: "local",
    name: "Local",
    description: "Private · No API key · Works offline",
    group: "Local",
    needsKey: false,
    needsBaseUrl: false,
    models: [
      { id: "tiny", label: "Tiny" },
      { id: "base", label: "Base" },
      { id: "small", label: "Small" },
      { id: "medium", label: "Medium" },
      { id: "large", label: "Large" },
    ],
  },
  {
    type: "novita",
    name: "Novita AI",
    description: "Experimental · ASR route unavailable",
    group: "Cloud",
    needsKey: true,
    needsBaseUrl: false,
    discoverModels: true,
    hidden: true,
    models: [{ id: "zai-org/glm-asr-2512", label: "GLM-ASR-2512" }],
  },
  {
    type: "openai",
    name: "OpenAI",
    description: "Cloud transcription",
    group: "Cloud",
    needsKey: true,
    needsBaseUrl: false,
    allowCustomModel: true,
    models: [
      { id: "whisper-1", label: "Whisper", recommended: true },
      { id: "gpt-4o-mini-transcribe", label: "GPT-4o mini Transcribe" },
      { id: "gpt-4o-transcribe", label: "GPT-4o Transcribe" },
    ],
  },
  {
    type: "groq",
    name: "Groq",
    description: "Fast cloud transcription",
    group: "Cloud",
    needsKey: true,
    needsBaseUrl: false,
    allowCustomModel: true,
    models: [
      { id: "whisper-large-v3", label: "Whisper Large v3", recommended: true },
      { id: "whisper-large-v3-turbo", label: "Whisper Large v3 Turbo" },
    ],
  },
  {
    type: "deepgram",
    name: "Deepgram",
    description: "Speech-to-text platform",
    group: "Cloud",
    needsKey: true,
    needsBaseUrl: false,
    allowCustomModel: true,
    models: [
      { id: "nova-2", label: "Nova 2", recommended: true },
      { id: "nova-3", label: "Nova 3" },
      { id: "enhanced", label: "Enhanced" },
    ],
  },
  {
    type: "assemblyai",
    name: "AssemblyAI",
    description: "Speech transcription platform",
    group: "Cloud",
    needsKey: true,
    needsBaseUrl: false,
    allowCustomModel: true,
    models: [
      { id: "best", label: "Best", recommended: true },
      { id: "nano", label: "Nano" },
    ],
  },
  {
    type: "openai-compatible",
    name: "Custom OpenAI-compatible",
    description: "Configure base URL, API key and model manually.",
    group: "Advanced",
    needsKey: true,
    needsBaseUrl: true,
    models: [{ id: "whisper-1", label: "whisper-1" }],
  },
];

export const AI_PROVIDERS: ProviderCatalogItem[] = [
  {
    type: "novita",
    name: "Novita AI",
    description: "Cloud AI models for summaries and analysis.",
    group: "Recommended",
    needsKey: true,
    needsBaseUrl: false,
    allowCustomModel: true,
    models: [],
  },
  {
    type: "openai",
    name: "OpenAI",
    description: "GPT models and OpenAI APIs.",
    group: "Popular",
    needsKey: true,
    needsBaseUrl: false,
    allowCustomModel: true,
    models: [],
  },
  {
    type: "anthropic",
    name: "Anthropic",
    description: "Claude models for analysis and summarization.",
    group: "Popular",
    needsKey: true,
    needsBaseUrl: false,
    allowCustomModel: true,
    models: [],
  },
  {
    type: "gemini",
    name: "Google Gemini",
    description: "Gemini models from Google AI.",
    group: "Popular",
    needsKey: true,
    needsBaseUrl: false,
    allowCustomModel: true,
    models: [],
  },
  {
    type: "groq",
    name: "Groq",
    description: "Fast inference for supported open models.",
    group: "Popular",
    needsKey: true,
    needsBaseUrl: false,
    allowCustomModel: true,
    models: [],
  },
  {
    type: "xai",
    name: "xAI",
    description: "Grok models from xAI.",
    group: "Popular",
    needsKey: true,
    needsBaseUrl: false,
    allowCustomModel: true,
    models: [],
  },
  {
    type: "openrouter",
    name: "OpenRouter",
    description: "Access many AI models through one API.",
    group: "Popular",
    needsKey: true,
    needsBaseUrl: false,
    allowCustomModel: true,
    models: [],
  },
  {
    type: "openai-compatible",
    name: "Custom OpenAI-compatible",
    description: "Connect any compatible chat/completions endpoint.",
    group: "Advanced",
    needsKey: true,
    needsBaseUrl: true,
    models: [],
  },
];

export const LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto detect" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "ja", label: "Japanese" },
];

export const LOCAL_MODEL_BLURBS: Record<string, string> = {
  tiny: "Fastest",
  base: "Balanced",
  small: "Recommended",
  medium: "Higher accuracy",
  large: "Highest accuracy",
};

export function catalogFor(capability: ProviderCapability) {
  const items = capability === "transcription" ? TRANSCRIPTION_PROVIDERS : AI_PROVIDERS;
  return items.filter((item) => !item.hidden);
}

export function catalogItem(capability: ProviderCapability, type: string) {
  return catalogFor(capability).find((item) => item.type === type);
}

export function isCustomCompatible(type: string) {
  return type === "openai-compatible";
}

export function defaultModelId(item: ProviderCatalogItem) {
  return item.models.find((model) => model.recommended)?.id ?? item.models[0]?.id ?? "";
}

export function providerModelLabel(capability: ProviderCapability, type: string, modelId: string) {
  if (type === "local") {
    return `Whisper ${modelId}`;
  }
  const known = catalogItem(capability, type)?.models.find((model) => model.id === modelId);
  if (known) {
    return known.label;
  }
  if (modelId.endsWith("glm-asr-2512")) {
    return "GLM-ASR-2512";
  }
  return modelId;
}

export function modelSelectOptions(item: ProviderCatalogItem) {
  const options = item.models.map((model) => ({
    value: model.id,
    label: model.recommended ? `${model.label} · Recommended` : model.label,
  }));
  if (item.allowCustomModel) {
    options.push({ value: CUSTOM_MODEL_VALUE, label: "Custom model…" });
  }
  return options;
}
