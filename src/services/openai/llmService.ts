import OpenAI from "openai";
import { apiLogger } from "@/services/logging/apiLogger";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const MODEL_NAME = process.env.OPENAI_MODEL || "gpt-4-min";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function callOpenAI(prompt: string): Promise<string> {
  const startTime = Date.now();

  try {
    const completionParams: any = {
      model: MODEL_NAME,
      messages: [
        {
          role: "system",
          content:
            "You are a professional travel planner. Create detailed, practical descriptions with specific places, realistic timing, and helpful descriptions.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    };

    const completion = await openai.chat.completions.create(completionParams);

    const response = completion.choices[0]?.message?.content;
    const duration = Date.now() - startTime;

    if (!response) {
      throw new Error("No response from OpenAI");
    }

    console.log("✅ OpenAI Response:", {
      duration: `${duration}ms`,
      responseLength: response.length,
      tokensUsed: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined,
      response:
        response.substring(0, 300) + (response.length > 300 ? "..." : ""),
    });

    // Log successful OpenAI call
    apiLogger.logOpenAICall({
      model: MODEL_NAME,
      prompt,
      response,
      tokensUsed: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined,
      duration,
      status: "success",
      fromCache: false,
    });

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error("❌ OpenAI Error:", {
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : String(error),
    });

    // Log failed OpenAI call
    apiLogger.logOpenAICall({
      model: MODEL_NAME,
      prompt,
      duration,
      status: "error",
      fromCache: false,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new Error("Failed to generate content with OpenAI");
  }
}
