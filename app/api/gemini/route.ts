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
 * Uses Chain-of-Thought and structured reasoning for better results.
 */
function buildFullPrompt(
  prompt: string,
  previousPrompt?: string,
  refinementInstruction?: string
): string {
  if (refinementInstruction && previousPrompt) {
    return `You are an expert Prompt Engineer specializing in iterative refinement.

## TASK
Refine the CURRENT PROMPT based on USER FEEDBACK while preserving its core intent.

## INPUTS
CURRENT PROMPT:
"""
${previousPrompt}
"""

USER FEEDBACK:
"""
${refinementInstruction}
"""

## REFINEMENT PROCESS
Follow these steps:
1. ANALYZE: Identify what specific changes the user wants
2. PRESERVE: Keep elements that work well and match the original intent
3. INTEGRATE: Apply feedback naturally without disrupting flow
4. ENHANCE: Add clarity, structure, and specificity where needed

## OPTIMIZATION PRINCIPLES
- Use clear, unambiguous language
- Add structure (headers, bullet points, examples) when beneficial
- Include specific constraints, formats, or output requirements
- Define the role/persona the AI should adopt
- Specify the desired tone and style

## OUTPUT FORMAT
Respond with ONLY a JSON object:
{
  "optimizedPrompt": "The complete refined prompt with all improvements integrated",
  "explanations": [
    "Change 1: Brief explanation of what was modified and why",
    "Change 2: Brief explanation of another key improvement"
  ],
  "suggestions": [
    "Specific actionable improvement 1",
    "Specific actionable improvement 2",
    "Specific actionable improvement 3"
  ]
}

## RULES
- Output ONLY the JSON object, no markdown code blocks, no extra text
- Each suggestion must be 3-8 words, action-oriented
- Explanations should be specific and reference actual changes
- Ensure the optimized prompt is ready to use as-is

BEGIN REFINEMENT:`;
  }
  return `You are an expert Prompt Engineer specializing in transforming vague inputs into high-quality, structured prompts.

## TASK
Transform the USER INPUT into an optimized, production-ready prompt.

## USER INPUT
"""
${prompt}
"""

## OPTIMIZATION FRAMEWORK
Apply these techniques:
1. ROLE DEFINITION: Assign a specific expert persona if relevant
2. CONTEXT: Add necessary background information
3. STRUCTURE: Use formatting (headers, lists, examples) for clarity
4. CONSTRAINTS: Define boundaries, formats, and requirements
5. EXAMPLES: Include input/output examples when helpful
6. OUTPUT FORMAT: Specify exactly how the response should be formatted

## QUALITY CHECKLIST
- Is the prompt unambiguous?
- Would a non-expert understand the task?
- Are outputs measurable/verifiable?
- Is the scope appropriately defined?

## OUTPUT FORMAT
Respond with ONLY a JSON object:
{
  "optimizedPrompt": "The complete optimized prompt ready for use",
  "explanations": [
    "Improvement 1: What was added and why it helps",
    "Improvement 2: Another key enhancement made"
  ],
  "suggestions": [
    "Specific actionable addition 1",
    "Specific actionable addition 2",
    "Specific actionable addition 3"
  ]
}

## RULES
- Output ONLY the JSON object, no markdown code blocks, no extra text
- Each suggestion must be 3-8 words, action-oriented
- Explanations should reference specific techniques used
- The optimized prompt must be immediately usable

BEGIN OPTIMIZATION:`;
}

/**
 * Builds a prompt to generate concise clarifying questions for a selected suggestion.
 * Uses focused inquiry to gather only essential missing information.
 */
function buildClarifyPrompt(params: {
  prompt: string;
  previousOptimizedPrompt?: string;
  selectedSuggestion: string;
}): string {
  const { prompt, previousOptimizedPrompt, selectedSuggestion } = params;
  return `You are a Requirements Analyst identifying critical missing information.

## TASK
Generate 2-3 specific clarifying questions to implement this suggestion:
"""
${selectedSuggestion}
"""

## CONTEXT
Original Input: "${prompt}"
Current Optimized Prompt: "${previousOptimizedPrompt || "(not yet created)"}"

## QUESTION DESIGN PRINCIPLES
1. SPECIFIC: Ask about concrete details, not vague concepts
2. ANSWERABLE: Questions should have clear, short answers
3. DISTINCT: Each question targets a different aspect
4. ESSENTIAL: Only ask for information critical to implementation
5. NOVEL: Don't ask about information already provided above

## OUTPUT FORMAT
Respond with ONLY a JSON object:
{
  "questions": [
    "First specific question under 15 words?",
    "Second specific question under 15 words?",
    "Third specific question under 15 words?"
  ]
}

## RULES
- Output ONLY the JSON object, no markdown code blocks, no extra text
- Maximum 3 questions
- Each question must end with a question mark
- Focus on actionable information needed NOW

BEGIN GENERATING QUESTIONS:`;
}

/**
 * Builds a prompt to refine the optimized prompt using Q&A answers.
 * Uses surgical precision to integrate new information with minimal disruption.
 */
function buildRefineWithAnswersPrompt(params: {
  previousOptimizedPrompt?: string;
  answers: Array<{ question: string; answer: string }>;
}): string {
  const { previousOptimizedPrompt, answers } = params;
  const qa = answers
    .map((x) => `Q: ${x.question}\nA: ${x.answer}`)
    .join("\n\n");
  return `You are a Prompt Refinement Specialist integrating user feedback.

## TASK
Incorporate the USER RESPONSES into the CURRENT PROMPT with minimal, surgical changes.

## CURRENT PROMPT
"""
${previousOptimizedPrompt || "(prompt not yet created - create from scratch using answers)"}
"""

## USER RESPONSES
${qa}

## INTEGRATION PRINCIPLES
1. PRESERVE: Keep the existing structure and effective elements
2. ENHANCE: Add specificity using the provided answers
3. NATURAL: Make additions feel organic to the original flow
4. FOCUSED: Only modify sections relevant to the new information
5. COMPLETE: Ensure all user answers are reflected in the prompt

## REFINEMENT APPROACH
- If a current prompt exists: Make targeted edits only
- If creating new: Build a complete prompt incorporating all answers
- Maintain consistent tone and style
- Ensure logical flow between sections

## OUTPUT FORMAT
Respond with ONLY a JSON object:
{
  "optimizedPrompt": "The refined prompt with all information integrated",
  "explanations": [
    "Change 1: What was modified based on which answer",
    "Change 2: Another integration made"
  ],
  "suggestions": [
    "Specific next improvement 1",
    "Specific next improvement 2",
    "Specific next improvement 3"
  ]
}

## RULES
- Output ONLY the JSON object, no markdown code blocks, no extra text
- Make minimal changes while fully incorporating answers
- Explanations must reference specific Q&A pairs
- Suggestions should target potential gaps

BEGIN REFINEMENT:`;
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
