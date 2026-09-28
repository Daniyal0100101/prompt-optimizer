export type ModelId =
  | "gemini-3.8-flash"
  | "gemini-3.7-flash"
  | "gemini-3.6-flash"
  | "gemini-3.5-flash"
  | "gemini-3.5-flash-lite";

export interface ModelInfo {
  id: ModelId;
  name: string;
  description: string;
  maxTokens: number; // Input token limit
  outputTokens: number; // Output token limit
  contextWindow: number; // Same as maxTokens for clarity
  releaseStatus: "stable";
  features: readonly string[];
  recommended?: boolean;
}

const ONE_MILLION_TOKEN_CONTEXT = 1_048_576;
const SIXTY_FIVE_THOUSAND_OUTPUT_TOKENS = 65_536;

export const SUPPORTED_MODELS: ModelInfo[] = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    description:
      "Google AI Studio free-tier model for strong general-purpose reasoning and prompt optimization",
    maxTokens: ONE_MILLION_TOKEN_CONTEXT,
    outputTokens: SIXTY_FIVE_THOUSAND_OUTPUT_TOKENS,
    contextWindow: ONE_MILLION_TOKEN_CONTEXT,
    releaseStatus: "stable",
    features: ["1M context", "64K output", "Stable", "Free tier"],
    recommended: true,
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    description:
      "Stable free-tier Flash model for coding, tool use, and multi-step tasks",
    maxTokens: ONE_MILLION_TOKEN_CONTEXT,
    outputTokens: SIXTY_FIVE_THOUSAND_OUTPUT_TOKENS,
    contextWindow: ONE_MILLION_TOKEN_CONTEXT,
    releaseStatus: "stable",
    features: ["1M context", "64K output", "Stable", "Free tier"],
  },
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    description:
      "Stable free-tier Flash model balancing speed and multimodal capabilities",
    maxTokens: ONE_MILLION_TOKEN_CONTEXT,
    outputTokens: SIXTY_FIVE_THOUSAND_OUTPUT_TOKENS,
    contextWindow: ONE_MILLION_TOKEN_CONTEXT,
    releaseStatus: "stable",
    features: ["1M context", "64K output", "Stable", "Free tier"],
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    description:
      "Stable free-tier Flash model for general-purpose and high-throughput tasks",
    maxTokens: ONE_MILLION_TOKEN_CONTEXT,
    outputTokens: SIXTY_FIVE_THOUSAND_OUTPUT_TOKENS,
    contextWindow: ONE_MILLION_TOKEN_CONTEXT,
    releaseStatus: "stable",
    features: ["1M context", "64K output", "Stable", "Free tier"],
  },
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash-Lite",
    description:
      "Stable free-tier option optimized for low-latency, cost-efficient requests",
    maxTokens: ONE_MILLION_TOKEN_CONTEXT,
    outputTokens: SIXTY_FIVE_THOUSAND_OUTPUT_TOKENS,
    contextWindow: ONE_MILLION_TOKEN_CONTEXT,
    releaseStatus: "stable",
    features: ["1M context", "64K output", "Stable", "Free tier", "Efficient"],
  },
];

// Gemini 3.8 Flash is Google's latest stable, free-tier general-purpose option.
export const getDefaultModelId = (): ModelId => "gemini-3.8-flash";

// Get model by ID
export const getModelById = (id: string): ModelInfo => {
  return (
    SUPPORTED_MODELS.find((model) => model.id === id) ||
    SUPPORTED_MODELS.find((model) => model.id === getDefaultModelId())!
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
