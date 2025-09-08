import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

async function generateWithRetry(
  genAI: any,
  resolvedModel: string,
  contents: any,
  config: any,
  retries = 3,
  delay = 800
) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await genAI.models.generateContent({
        model: resolvedModel,
        contents,
        config,
      });
    } catch (err: any) {
      const retriable = [429, 500, 503];
      if (retriable.includes(err?.status) && attempt < retries) {
        console.warn(
          `GenAI transient error (status=${err.status}). Retrying attempt ${attempt}/${retries} after ${
            delay * attempt
          }ms.`
        );
        await new Promise((res) => setTimeout(res, delay * attempt));
        continue;
      }
      throw err;
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, model, apiKey, previousPrompt, refinementInstruction } =
      body;

    if ((!prompt && !previousPrompt) || !model || !apiKey) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: prompt/previousPrompt, model, or apiKey",
        },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenAI({ apiKey });

    const resolvedModel =
      typeof model === "string" && model.trim()
        ? model.trim()
        : "gemini-2.0-flash";
    const supportsSchema = /1\.5|2\./.test(resolvedModel);

    const fullPrompt =
      refinementInstruction && previousPrompt
        ? `
        You are a prompt engineering expert specializing in iterative refinement for large language models.
        Existing prompt: "${previousPrompt}"
        User feedback: "${refinementInstruction}"

        Refine the prompt by analyzing the feedback and making targeted, meaningful changes. Do not append the instruction verbatim—integrate it thoughtfully. Ensure clarity, specificity, and effectiveness.

        Output strictly as JSON: {
          "optimizedPrompt": "The refined prompt as a single, cohesive string.",
          "explanations": ["Brief explanation of change 1.", "Explanation of change 2."]
        }
      `
        : `
        You are a prompt engineering expert for large language models.
        User input: "${prompt}"

        Transform this into an optimized prompt: Make it clear, concise, and high-impact. Use techniques like role assignment, context, output format, few-shot examples, or step-by-step guidance.

        Output strictly as JSON: {
          "optimizedPrompt": "The fully optimized prompt as a single string.",
          "explanations": ["Specific improvement 1.", "Improvement 2."]
        }
      `;

    const contents = [{ role: "user", parts: [{ text: fullPrompt }] }];

    const config: any = {};
    if (supportsSchema) {
      config.responseMimeType = "application/json";
      config.responseSchema = {
        type: "object",
        properties: {
          optimizedPrompt: { type: "string" },
          explanations: { type: "array", items: { type: "string" } },
        },
        required: ["optimizedPrompt", "explanations"],
      };
    } else {
      config.responseMimeType = "application/json";
    }

    // --- call model with retry ---
    const result = await generateWithRetry(genAI, resolvedModel, contents, config);

    const text = result.text;

    if (!text) {
      return NextResponse.json({
        optimizedPrompt: "",
        explanations: ["No response text provided."],
      });
    }

    // --- try parsing JSON safely ---
    try {
      return NextResponse.json(JSON.parse(text));
    } catch {
      const stripped =
        text
          ?.replace(/^```json\s*/i, "")
          .replace(/^```/, "")
          .replace(/```$/, "")
          .trim() ?? "";

      try {
        return NextResponse.json(JSON.parse(stripped));
      } catch {
        return NextResponse.json({
          optimizedPrompt: stripped || text || "",
          explanations: [
            "Unable to parse structured response; using raw output.",
          ],
        });
      }
    }
  } catch (error: any) {
    console.error("Error in GenAI API route:", error);
    return NextResponse.json(
      {
        error:
          error?.message || error?.status?.message || "Internal Server Error",
      },
      { status: error?.status || 500 }
    );
  }
}
