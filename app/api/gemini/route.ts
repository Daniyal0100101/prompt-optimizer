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
      You are a prompt engineering expert who specializes in iterative refinement for large language models.
      
      Existing prompt: "${previousPrompt}".
      User feedback: "${refinementInstruction}".

      Refine the prompt, considering the feedback, by making targeted, meaningful changes. 
      Analyze the feedback and integrate it thoughtfully into the prompt. Ensure clarity, specificity, structure and effectiveness. 
      Avoid appending the instruction verbatim and instead focus on integrating it in a way that enhances the prompt.

      Preserve the user's original tone, keywords, terminology, and language unless explicitly asked to change them. 
      If you change a key term, keep it minimal and justify briefly in explanations. If you change the structure, justify briefly in explanations.

      Quality Checklist (apply silently):
      - Clarity, specificity and structure
      - Audience fit and structure
      - Platform/length constraints enforced (if applicable)
      - Avoid boilerplate
      - Maintain user language

      Suggestions Guidelines:
      - Provide 2–3 concise next-step suggestion phrases (<=12 words each)
      - Do not use quotes or prefixes like 'Ask the user:'
      - Use imperative mood, e.g. 'Quantify benefits'
      - Do not repeat suggestions from the previous turn, do not suggest the same suggestion twice.
      - Do not output placeholders like 'Suggestion 1'

      Output strictly as JSON: {
        "optimizedPrompt": "The refined prompt as a clear, structured, and high-impact string.",
        "explanations": [
          "Brief explanation of the specific change made for the prompt, including the structure if changed.",
          "Additional explanation of any other changes made to the prompt."
        ],
        "suggestions": ["Short actionable suggestion", "Another concise next step"]
      }
    `;
  }
  return `
    You are a prompt engineering expert who specializes in optimizing prompts for large language models.

    User input: "${prompt}".

    Transform this prompt into an optimized prompt by making it clear, structured, and high-impact. 
    Use techniques like role assignment, context, output format, few-shot examples, or step-by-step guidance to enhance the prompt. 
    Analyze the prompt and identify areas for improvement. Aim for a prompt that is both precise, structured and impactful.

    Suggestions Guidelines:
    - Return 2–3 concise next-step suggestion phrases (<=12 words each)
    - No quotes or prefixes (avoid 'Ask the user:'), imperative mood
    - Examples: 'Quantify revenue impact', 'Specify timeline', 'Provide specific examples'
    - Do not repeat suggestions from the previous turn, do not suggest the same suggestion twice.
    - Do not output placeholders like 'Suggestion 1'

    Output strictly as JSON: {
      "optimizedPrompt": "The fully optimized prompt as a clear, structured, and high-impact string.",
      "explanations": [
        "Specific explanation of how the prompt was improved in terms of clarity, specificity, structure and effectiveness.",
        "Additional explanation of any other improvements made to the prompt."
      ],
      "suggestions": ["Short actionable suggestion", "Another concise next step"]
    }
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
    You are assisting as a prompt engineer. Based on the user's original input and the current optimized prompt, 
    generate the smallest set of clarifying questions needed to effectively apply the following next step:
    Suggestion: "${selectedSuggestion}"

    Context:
    - Original input: "${prompt}"
    - Current optimized prompt: "${previousOptimizedPrompt || "(not available)"}"

    Guidelines:
    - Return only a JSON object with a single key: "questions".
    - Provide 2 to 4 concise, targeted questions.
    - Avoid repeating information, avoid quotes and numbering.
    - Each question should be self-contained and under 18 words.
    - Do not repeat questions from the previous turn, do not ask the same question twice.
    - Choose from canonical slots only if missing or ambiguous: {audience, desired outcome/metrics, tone, constraints (length/platform), timeframe, examples, domain nuances}.
    - Ask only about missing or ambiguous items; do not ask what is already known.

    Output strictly as JSON: { "questions": ["Question 1", "Question 2"] }
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
    You are a prompt engineering expert specializing in iterative refinement.
    Current optimized prompt: "${previousOptimizedPrompt || "(not available)"}"

    Additional details provided by the user:
    ${qa}

    Refine the optimized prompt by incorporating the provided answers. Make targeted edits only to the parts affected by the answers. 
    Preserve earlier constraints (tone, audience, platform/length). Ensure clarity, specificity, and effectiveness.
    Do not add meta-commentary.

    Output strictly as JSON: {
      "optimizedPrompt": "The refined prompt as a single, cohesive string.",
      "explanations": ["Most important change (<=18 words).", "Another key change (<=18 words)."],
      "suggestions": [
        "A concise next step to further improve the prompt",
        "Another short actionable refinement"
      ]
    }
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
