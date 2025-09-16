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
}

/**
 * Maps low-level provider errors to user-friendly messages.
 */
function getFriendlyErrorMessage(status: number, raw: string): string {
  const msg = raw?.toLowerCase() || "";
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
 * @param model - The model to use for generation.
 * @param contents - The content to send to the model.
 * @param config - The generation configuration.
 * @param retries - The number of retry attempts.
 * @param delay - The initial delay between retries.
 * @returns The generated content result.
 */
async function generateWithRetry(
  genAI: GoogleGenAI,
  model: string,
  contents: ContentListUnion,
  config: GenerateContentConfig,
  retries = 3,
  delay = 800
): Promise<GenerateContentResponse> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await genAI.models.generateContent({
        model,
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
      You are a prompt engineering expert specializing in iterative refinement for large language models.
      Existing prompt: "${previousPrompt}"
      User feedback: "${refinementInstruction}"

      Refine the prompt by analyzing the feedback and making targeted, meaningful changes. Do not append the instruction verbatim—integrate it thoughtfully. Ensure clarity, specificity, and effectiveness.

      Output strictly as JSON: {
        "optimizedPrompt": "The refined prompt as a single, cohesive string.",
        "explanations": ["Brief explanation of change 1.", "Explanation of change 2."]
      }
    `;
  }
  return `
    You are a prompt engineering expert for large language models.
    User input: "${prompt}"

    Transform this into an optimized prompt: Make it clear, concise, and high-impact. Use techniques like role assignment, context, output format, few-shot examples, or step-by-step guidance.

    Output strictly as JSON: {
      "optimizedPrompt": "The fully optimized prompt as a single string.",
      "explanations": ["Specific improvement 1.", "Improvement 2."]
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
): Promise<NextResponse<ApiResponseSuccess | ApiResponseError>> {
  try {
    const body: ApiRequestBody = await req.json();
    const {
      prompt,
      model = "gemini-1.5-flash",
      apiKey,
      previousPrompt,
      refinementInstruction,
    } = body;

    if ((!prompt && !previousPrompt) || !model || !apiKey) {
      throw new ApiError(
        "Missing required fields: prompt/previousPrompt, model, or apiKey",
        400
      );
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

    const fullPrompt = buildFullPrompt(
      prompt || "",
      previousPrompt,
      refinementInstruction
    );
    const contents: ContentListUnion = fullPrompt;

    const config: GenerateContentConfig = {
      // Default to JSON output
      responseMimeType: "application/json",
    };

    if (supportsSchema) {
      config.responseSchema = {
        type: "object",
        properties: {
          optimizedPrompt: { type: "string" },
          explanations: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["optimizedPrompt", "explanations"],
      } as SchemaUnion;
    }

    const result = await generateWithRetry(
      genAI,
      resolvedModel,
      contents,
      config
    );

    const responseText = result.text as string | undefined;
    const parsedData = parseResponse(responseText);

    return NextResponse.json(parsedData);
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
