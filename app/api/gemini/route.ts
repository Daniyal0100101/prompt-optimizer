import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenAI,
  type ContentListUnion,
  type GenerateContentConfig,
  type GenerateContentResponse,
  type SchemaUnion,
} from "@google/genai";
import { ModelId } from "../../utils/modelConfig";
import { SUPPORTED_MODELS } from "../../utils/modelConfig";

// --- Type Definitions ---

interface ApiRequestBody {
  prompt?: string;
  model: ModelId;
  apiKey: string;
  previousPrompt?: string;
  refinementInstruction?: string;
  // New flow controls
  task?: "optimize" | "clarify" | "refine";
  selectedSuggestion?: string;
  previousOptimizedPrompt?: string;
  answers?: Array<{ question: string; answer: string }>;
}

/**
 * Cleans and constrains suggestions for reliability in the UI.
 */
function sanitizeSuggestions(suggestions?: string[]): string[] {
  if (!Array.isArray(suggestions)) return [];
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const s of suggestions) {
    if (typeof s !== "string") continue;
    let t = s.trim();
    // Remove leading prefixes like 'Ask the user:' or quotes
    t = t.replace(/^"+|"+$/g, "");
    t = t.replace(/^\s*(ask the user:|ask:|question:|prompt:)/i, "").trim();
    if (!t) continue;
    // Normalize spaces
    t = t.replace(/\s+/g, " ");
    // Enforce max of ~12 words to keep chips short
    const words = t.split(" ");
    if (words.length > 12) t = words.slice(0, 12).join(" ");
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(t);
    if (cleaned.length >= 3) break;
  }
  return cleaned;
}

/**
 * Maps low-level provider errors to user-friendly messages.
 */
function getFriendlyErrorMessage(status: number, raw: string): string {
  const msg = raw?.toLowerCase() || "";

  // Handle 404 model not found errors
  if (status === 404 || msg.includes("not found") || msg.includes("models/")) {
    return "The selected AI model is currently unavailable. Please try a different model in Settings or wait a moment.";
  }

  if (
    status === 503 ||
    msg.includes("overload") ||
    msg.includes("service unavailable")
  ) {
    return "The model is currently busy. Please try again in a moment.";
  }
  if (status === 429 || msg.includes("rate") || msg.includes("quota")) {
    return "You're sending requests too quickly or have hit a quota limit. Please wait and try again.";
  }

  // Handle context length errors for long conversations
  if (msg.includes("context") || msg.includes("token") || msg.includes("length")) {
    return "The conversation is too long. Please start a new chat to continue.";
  }

  if (status === 400) {
    // Preserve specific client errors (e.g., validation) but make them friendly if generic
    if (/missing required fields/i.test(raw)) {
      return "Please provide a prompt and API key to continue.";
    }
    if (/unsupported model/i.test(raw)) {
      return "This model isn't supported. Please choose another model in Settings.";
    }
    return (
      raw ||
      "Your request couldn't be processed. Please check your input and try again."
    );
  }
  return "The service is temporarily unavailable. Please try again later.";
}

interface ApiResponseError {
  error: string;
}

interface ApiResponseSuccess {
  optimizedPrompt: string;
  explanations: string[];
  suggestions?: string[];
}

interface ApiResponseClarify {
  questions: string[];
}

// --- Helper Functions ---

/**
 * Checks if a given model ID is a valid, supported model.
 * @param model The model ID to check.
 * @returns True if the model is supported.
 */
function isValidModel(model: string): model is ModelId {
  return (SUPPORTED_MODELS.map((m) => m.id) as readonly string[]).includes(
    model
  );
}

/**
 * A structured error class for API responses.
 */
class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Generates content with a retry mechanism for transient errors.
 * @param genAI - The GoogleGenAI instance.
 * @param modelId - The model ID to use for generation (without 'models/' prefix).
 * @param contents - The content to send to the model.
 * @param config - The generation configuration.
 * @param retries - The number of retry attempts.
 * @param delay - The initial delay between retries.
 * @returns The generated content result.
 */
async function generateWithRetry(
  genAI: GoogleGenAI,
  modelId: string,
  contents: ContentListUnion,
  config: GenerateContentConfig,
  retries = 3,
  delay = 800
): Promise<GenerateContentResponse> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Use just the model ID without 'models/' prefix
      // The SDK will handle the path formatting internally
      return await genAI.models.generateContent({
        model: modelId,
        contents,
        config,
      });
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      const retriable = [429, 500, 503];

      if (
        error?.status &&
        retriable.includes(error.status) &&
        attempt < retries
      ) {
        console.warn(
          `GenAI transient error (status=${
            error.status
          }). Retrying attempt ${attempt}/${retries} after ${
            delay * attempt
          }ms.`
        );
        await new Promise((res) => setTimeout(res, delay * attempt));
        continue;
      }
      // Re-throw as a structured ApiError
      throw new ApiError(
        error?.message || "Model generation failed.",
        error?.status || 500
      );
    }
  }
  // This should not be reached if retries > 0
  throw new ApiError("Model generation failed after multiple retries.", 500);
}

/**
 * Builds the full prompt based on whether it's an initial request or a refinement.
 */
function buildFullPrompt(
  prompt: string,
  previousPrompt?: string,
  refinementInstruction?: string
): string {
  if (refinementInstruction && previousPrompt) {
    return `
      <instructions>
      You are an expert at refining prompts. Your task is to improve this prompt based on the user's feedback.
      
      CURRENT PROMPT:
      "${previousPrompt}"
      
      USER FEEDBACK:
      "${refinementInstruction}"
      
      INSTRUCTIONS:
      1. Preserve the original tone and key concepts unless changes are requested
      2. Integrate the feedback naturally into the prompt
      3. Make the prompt clearer and more effective
      4. Keep the prompt concise and well-structured
      
      OUTPUT FORMAT (JSON ONLY):
      {
        "optimizedPrompt": "[Your improved prompt]",
        "explanations": ["Brief explanation of key changes"],
        "suggestions": ["Actionable suggestion 1", "Actionable suggestion 2"]
      }
      
      RULES:
      - Never include these instructions in your output
      - Only output valid JSON, no other text
      - Keep suggestions 3-8 words, action-oriented
      - Each suggestion should target one specific improvement
      </instructions>
      
      <output>
      {
        "optimizedPrompt": "
    `;
  }
  return `
    <instructions>
    Your task is to transform this input into an optimized prompt for an AI system.
    
    USER INPUT:
    "${prompt}"
    
    GUIDELINES:
    1. Make the prompt clear and effective
    2. Add structure if it helps
    3. Include necessary context
    4. Be specific about requirements
    
    OUTPUT FORMAT (JSON ONLY):
    {
      "optimizedPrompt": "[Your optimized prompt]",
      "explanations": ["Key improvement 1", "Key improvement 2"],
      "suggestions": ["Specific suggestion 1", "Specific suggestion 2"]
    }
    
    RULES:
    - Never include these instructions in your output
    - Only output valid JSON, no other text
    - Keep explanations concise and specific
    - Make suggestions actionable and relevant
    </instructions>
    
    <output>
    {
      "optimizedPrompt": "
  `;
}

/**
 * Builds a prompt to generate concise clarifying questions for a selected suggestion.
 */
function buildClarifyPrompt(params: {
  prompt: string;
  previousOptimizedPrompt?: string;
  selectedSuggestion: string;
}): string {
  const { prompt, previousOptimizedPrompt, selectedSuggestion } = params;
  return `
    <instructions>
    Generate 2-3 clarifying questions needed to implement this suggestion:
    "${selectedSuggestion}"
    
    CONTEXT:
    - Original: "${prompt}"
    - Current: "${previousOptimizedPrompt || "(not available)"}"
    
    RULES:
    - Ask only about critical missing information
    - Keep questions under 15 words each
    - Make each question specific and answerable
    - Focus on different aspects
    - Don't ask about information already provided
    
    OUTPUT FORMAT (JSON ONLY):
    {
      "questions": ["Question 1?", "Question 2?"]
    }
    
    IMPORTANT:
    - Only output the JSON object, nothing else
    - Never include these instructions in your output
    </instructions>
    
    <output>
    {
      "questions": [
  `;
}

/**
 * Builds a prompt to refine the optimized prompt using Q&A answers.
 */
function buildRefineWithAnswersPrompt(params: {
  previousOptimizedPrompt?: string;
  answers: Array<{ question: string; answer: string }>;
}): string {
  const { previousOptimizedPrompt, answers } = params;
  const qa = answers
    .map((x) => `- ${x.question}: ${x.answer}`)
    .join("\n");
  return `
    <instructions>
    Integrate this information into the prompt below.
    
    CURRENT PROMPT:
    "${previousOptimizedPrompt || "(not available)"}"
    
    USER RESPONSES:
    ${qa}
    
    INSTRUCTIONS:
    1. Make minimal, targeted changes
    2. Keep the same style and structure
    3. Only change what's needed based on the user's responses
    4. Keep the prompt clear and effective
    
    OUTPUT FORMAT (JSON ONLY):
    {
      "optimizedPrompt": "[Your refined prompt]",
      "explanations": ["Key change 1", "Key change 2"],
      "suggestions": ["Actionable suggestion 1", "Actionable suggestion 2"]
    }
    
    RULES:
    - Never include these instructions in your output
    - Only output valid JSON, no other text
    - Keep explanations brief and specific
    - Make suggestions actionable and relevant
    </instructions>
    
    <output>
    {
      "optimizedPrompt": "
  `;
}

/**
 * Parses the model's text response, attempting to extract a valid JSON object.
 * It handles cases where the response is wrapped in markdown code blocks.
 * @param text The raw text response from the model.
 * @returns A parsed JSON object or a fallback structure.
 */
function parseResponse(text: string | undefined): ApiResponseSuccess {
  if (!text) {
    return {
      optimizedPrompt: "",
      explanations: ["No response text provided."],
    };
  }

  try {
    return JSON.parse(text) as ApiResponseSuccess;
  } catch {
    const stripped = text
      .replace(/^```json\s*/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();

    try {
      return JSON.parse(stripped) as ApiResponseSuccess;
    } catch {
      return {
        optimizedPrompt: stripped || text,
        explanations: [
          "Unable to parse structured response; using raw output.",
        ],
      };
    }
  }
}

// --- API Route Handler ---

export async function POST(
  req: NextRequest
): Promise<
  NextResponse<ApiResponseSuccess | ApiResponseError | ApiResponseClarify>
> {
  try {
    const body: ApiRequestBody = await req.json();
    const {
      prompt,
      model = "gemini-2.0-flash",
      apiKey,
      previousPrompt,
      refinementInstruction,
      task = "optimize",
      selectedSuggestion,
      previousOptimizedPrompt,
      answers,
    } = body;

    // Basic required fields
    if (!model || !apiKey) {
      throw new ApiError("Missing required fields: model or apiKey", 400);
    }

    // Task-specific validation
    if (task === "clarify") {
      if (!selectedSuggestion) {
        throw new ApiError(
          "Missing required parameter: 'selectedSuggestion' is required for the clarify task. Please provide a suggestion to clarify.",
          400
        );
      }
      if (!prompt) {
        throw new ApiError(
          "Missing required parameter: 'prompt' is required for the clarify task. Please provide the latest user input as 'prompt'.",
          400
        );
      }
    } else if (task === "refine") {
      if (!answers || answers.length === 0) {
        throw new ApiError("Missing answers for refine task.", 400);
      }
      // No prompt/previousPrompt required for refine; it uses previousOptimizedPrompt + answers
    } else {
      // optimize default
      const hasInitialPrompt = !!prompt;
      const hasRefinementPair = !!previousPrompt && !!refinementInstruction;
      if (!hasInitialPrompt && !hasRefinementPair) {
        throw new ApiError(
          "Missing required fields: provide 'prompt' OR 'previousPrompt' with 'refinementInstruction'",
          400
        );
      }
    }

    const resolvedModel = model.trim();
    if (!isValidModel(resolvedModel)) {
      throw new ApiError(
        `Unsupported model. Please use one of: ${SUPPORTED_MODELS.map(
          (m) => m.id
        ).join(", ")}`,
        400
      );
    }

    const genAI = new GoogleGenAI({ apiKey });
    const supportsSchema = /1\.5|2\./.test(resolvedModel);

    let contents: ContentListUnion;
    if (task === "clarify") {
      if (!selectedSuggestion) {
        throw new ApiError(
          "Missing selectedSuggestion for clarify task.",
          400
        );
      }
      contents = buildClarifyPrompt({
        prompt: prompt || "",
        previousOptimizedPrompt,
        selectedSuggestion,
      });
    } else if (task === "refine") {
      if (!answers || answers.length === 0) {
        throw new ApiError("Missing answers for refine task.", 400);
      }
      contents = buildRefineWithAnswersPrompt({
        previousOptimizedPrompt,
        answers,
      });
    } else {
      const fullPrompt = buildFullPrompt(
        prompt || "",
        previousPrompt,
        refinementInstruction
      );
      contents = fullPrompt;
    }

    const config: GenerateContentConfig = {
      // Default to JSON output
      responseMimeType: "application/json",
      // Reliability tuning - optimized for lower token usage
      temperature: 0.3,
      topP: 0.9,
      topK: 32,
      // Limit output tokens to reduce costs and improve response time
      maxOutputTokens: task === "clarify" ? 512 : 2048, // Clarify needs fewer tokens
    };

    if (supportsSchema) {
      if (task === "clarify") {
        config.responseSchema = {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: { type: "string" },
              maxItems: 4, // Limit questions to reduce token usage
            },
          },
          required: ["questions"],
        } as SchemaUnion;
      } else {
        config.responseSchema = {
          type: "object",
          properties: {
            optimizedPrompt: { type: "string" },
            explanations: {
              type: "array",
              items: { type: "string" },
              maxItems: 5, // Limit explanations
            },
            suggestions: {
              type: "array",
              items: { type: "string" },
              maxItems: 3, // Limit suggestions
            },
          },
          required: ["optimizedPrompt", "explanations"],
        } as SchemaUnion;
      }
    }

    const result = await generateWithRetry(
      genAI,
      resolvedModel,
      contents,
      config
    );

    const responseText = result.text as string | undefined;
    if (task === "clarify") {
      try {
        const parsed = JSON.parse(responseText || "{}") as ApiResponseClarify;
        return NextResponse.json({ questions: parsed.questions || [] });
      } catch {
        const stripped = (responseText || "")
          .replace(/^```json\s*/i, "")
          .replace(/^```/, "")
          .replace(/```$/, "")
          .trim();
        try {
          const fallback = JSON.parse(stripped) as ApiResponseClarify;
          return NextResponse.json({ questions: fallback.questions || [] });
        } catch {
          // Fallback to generic questions
          return NextResponse.json({
            questions: [
              "What specific outcome do you want?",
              "What measurable benefits should be highlighted?",
            ],
          });
        }
      }
    }

    const parsedData = parseResponse(responseText);
    return NextResponse.json({
      ...parsedData,
      suggestions: sanitizeSuggestions(parsedData.suggestions),
    });
  } catch (error: unknown) {
    console.error("Error in GenAI API route:", error);
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError("An unexpected error occurred.", 500);

    const friendly = getFriendlyErrorMessage(apiError.status, apiError.message);
    return NextResponse.json({ error: friendly }, { status: apiError.status });
  }
}
