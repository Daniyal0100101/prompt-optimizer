import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {

    // --- parse and validate request body ---
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

    // --- construct prompt based on whether it's an initial optimization or a refinement ---
    const fullPrompt =
      refinementInstruction && previousPrompt
        ? `
        You are a prompt engineering expert specializing in iterative refinement for large language models.
        Existing prompt: "${previousPrompt}"
        User feedback: "${refinementInstruction}"

        Refine the prompt by analyzing the feedback and making targeted, meaningful changes. Do not append the instruction verbatim—integrate it thoughtfully to enhance clarity, specificity, and effectiveness. Consider adding role-playing, step-by-step reasoning (e.g., chain-of-thought), examples, or output formatting if they address the feedback and improve results.

        Output strictly as JSON: {
          "optimizedPrompt": "The refined prompt as a single, cohesive string.",
          "explanations": ["Brief explanation of change 1 and why it improves the prompt.", "Explanation of change 2, etc."]
        }
        Ensure explanations are concise, actionable, and directly linked to the feedback.
      `
        : `
        You are a prompt engineering expert for large language models.
        User input: "${prompt}"

        Transform this into an optimized prompt: Make it clear, concise, and high-impact. Use techniques like assigning a role to the AI, providing context, specifying exact output format (e.g., JSON, bullet points), including few-shot examples if helpful, or guiding step-by-step thinking to leverage the model's strengths.

        Output strictly as JSON: {
          "optimizedPrompt": "The fully optimized prompt as a single string.",
          "explanations": ["Specific improvement 1 and its benefit.", "Improvement 2, etc."]
        }
        Focus on eliciting precise, creative, and reliable responses from the model.
      `;

    const contents = [{ role: "user", parts: [{ text: fullPrompt }] }];

    // --- configure response schema if supported by the model ---
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

    const result = await genAI.models.generateContent({
      model: resolvedModel,
      contents,
      config,
    });

    // --- parse and clean up the response ---
    const text = result.text;

    if (!text) {
      return NextResponse.json({
        optimizedPrompt: "",
        explanations: ["No response text provided."],
      });
    }

    try {
      return NextResponse.json(JSON.parse(text));
    } catch {
      const stripped =
        text
          ?.replace(/^```json\s*\n?/, "")
          .replace(/^```\s*\n?/, "")
          .replace(/\s*```$/, "")
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
    // --- end response parsing ---
  } catch (error: any) {
    console.error("Error in GenAI API route:", error);
    return NextResponse.json(
      {
        error:
          error?.status?.message || error?.message || "Internal Server Error",
      },
      { status: error?.status || 500 }
    );
  }
}
