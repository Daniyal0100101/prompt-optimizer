import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const { prompt, model, apiKey, previousPrompt, refinementInstruction } = await req.json();

    if ((!prompt && !previousPrompt) || !model || !apiKey) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    const resolvedModel = typeof model === 'string' && model.trim() ? model : 'gemini-1.5-flash';
    const supportsSchema = /1\.5/.test(resolvedModel);
    const generationConfig: GenerationConfig = supportsSchema
      ? {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              optimizedPrompt: { type: "string" },
              explanations: { type: "array", items: { type: "string" } },
            },
            required: ["optimizedPrompt", "explanations"],
          } as any,
        }
      : {
          // Fallback for models without schema support
          responseMimeType: "application/json",
        };

    const geminiModel = genAI.getGenerativeModel({ model: resolvedModel, generationConfig });

    const fullPrompt = refinementInstruction && previousPrompt
    ? `
      You are an expert in crafting prompts for Large Language Models.
      Your task is to refine an existing prompt based on user feedback.
      The target model for the optimized prompt is: ${model}.
      The existing prompt is: "${previousPrompt}"
      The user's refinement instruction is: "${refinementInstruction}"

      Your response must be a JSON object with two keys:
      1. "optimizedPrompt": A string containing the newly refined prompt.
      2. "explanations": An array of strings, where each string explains a change made based on the refinement instruction.

      Incorporate the user's feedback to improve the prompt. Do not simply append the instruction.
    `
    : `
      You are an expert in crafting prompts for Large Language Models.
      Your task is to take a user's raw instructions and transform them into a highly effective and optimized prompt for the ${model} model.
      The user's instructions are: "${prompt}"

      Your response must be a JSON object with two keys:
      1. "optimizedPrompt": A string containing the new, improved prompt.
      2. "explanations": An array of strings, where each string is a brief explanation of a specific change or improvement you made.

      The new prompt should be clear, concise, and structured to elicit the best possible response from the ${model} model.
      Follow best practices for prompt engineering, such as providing clear context, using strong action verbs, and specifying the desired format for the output.
    `;

    const result = await geminiModel.generateContent(fullPrompt);
    const response = await result.response;
    let text = response.text();
    // Try to parse JSON, strip code fences if present
    try {
      return NextResponse.json(JSON.parse(text));
    } catch (_) {
      // Remove ```json ... ``` or ``` ... ``` fences (no dotAll flag to support older targets)
      const stripped = text
        .replace(/^```json[\s\S]*?\n/, '')
        .replace(/^```[\s\S]*?\n/, '')
        .replace(/```$/g, '')
        .trim();
      try {
        return NextResponse.json(JSON.parse(stripped));
      } catch (_) {
        // As a last resort, return the raw text as optimizedPrompt
        return NextResponse.json({ optimizedPrompt: stripped || text, explanations: [] });
      }
    }

  } catch (error: any) {
    console.error('Error in Gemini API route:', error);
    const message = error?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
