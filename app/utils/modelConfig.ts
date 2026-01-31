export type ModelId =
  | "gemini-2.0-flash"
  | "gemini-2.5-flash"
  | "gemini-2.5-flash-lite"
  | "gemini-2.5-pro";

export interface ModelInfo {
  id: ModelId;
  name: string;
  description: string;
  maxTokens: number; // Input token limit
  outputTokens: number; // Output token limit
  contextWindow: number; // Same as maxTokens for clarity
  recommended?: boolean;
}

export const SUPPORTED_MODELS: ModelInfo[] = [
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    description:
      "Best price-performance model with thinking capabilities and well-rounded features",
    maxTokens: 1_048_576, // 1M tokens input
    outputTokens: 65_536, // 64K tokens output
    contextWindow: 1_048_576,
    recommended: true,
  },
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash-Lite",
    description:
      "Most cost-efficient option for high-volume tasks with excellent quality",
    maxTokens: 1_048_576, // 1M tokens input
    outputTokens: 8_192, // 8K tokens output
    contextWindow: 1_048_576,
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    description:
      "Flagship thinking model for complex reasoning, coding, and multi-step tasks",
    maxTokens: 1_048_576, // 1M tokens input
    outputTokens: 65_536, // 64K tokens output
    contextWindow: 1_048_576,
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    description:
      "Fast responses with native tool use and multimodal capabilities",
    maxTokens: 1_048_576, // 1M tokens input
    outputTokens: 8_192, // 8K tokens output
    contextWindow: 1_048_576,
  },
];

// Get default model ID - 2.5 Flash is the recommended price-performance option
export const getDefaultModelId = (): ModelId => "gemini-2.5-flash";

// Get model by ID
export const getModelById = (id: string): ModelInfo => {
  return (
    SUPPORTED_MODELS.find((model) => model.id === id) || SUPPORTED_MODELS[2] // Default to 2.5 Flash
  );
};

// Save selected model to localStorage
export const saveSelectedModel = (modelId: ModelId): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem("selected-model", modelId);
  }
};

// Get selected model from localStorage or return default
export const getSelectedModel = (): ModelId => {
  if (typeof window === "undefined") return getDefaultModelId();
  const saved = localStorage.getItem("selected-model");
  return saved && SUPPORTED_MODELS.some((m) => m.id === saved)
    ? (saved as ModelId)
    : getDefaultModelId();
};

// Helper to get token conversion info
export const getTokenInfo = () => ({
  charactersPerToken: 4,
  wordsPerHundredTokens: "60-80 English words",
  note: "Token count varies by language and content type",
});

// Validate if a model supports specific features
export const getModelCapabilities = (modelId: ModelId) => {
  const capabilities = {
    "gemini-2.0-flash": {
      multimodal: true,
      functionCalling: true,
      caching: true,
      tuning: false,
      codeExecution: true,
      thinking: false,
      liveAPI: true,
      maxVideoLength: "varies",
      maxAudioLength: "varies",
    },
    "gemini-2.5-flash": {
      multimodal: true,
      functionCalling: true,
      caching: true,
      tuning: false,
      codeExecution: true,
      thinking: true,
      searchGrounding: true,
      maxVideoLength: "varies",
      maxAudioLength: "varies",
    },
    "gemini-2.5-flash-lite": {
      multimodal: true,
      functionCalling: true,
      caching: true,
      tuning: false,
      codeExecution: true,
      thinking: true,
      searchGrounding: false,
      maxVideoLength: "varies",
      maxAudioLength: "varies",
    },
    "gemini-2.5-pro": {
      multimodal: true,
      functionCalling: true,
      caching: true,
      tuning: false,
      codeExecution: true,
      thinking: true,
      searchGrounding: true,
      reasoning: "advanced",
      maxVideoLength: "varies",
      maxAudioLength: "varies",
    },
  };

  return capabilities[modelId];
};
