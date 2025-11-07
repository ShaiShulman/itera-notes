import OpenAI from "openai";
import { createItineraryPrompt } from "@/features/generateLLM/promptBuilder";
import { parseItineraryResponse } from "@/features/generateLLM/responseParser";
import { enrichPlacesWithGoogleData } from "@/features/generateLLM/enrichment";
import { GeneratedItinerary } from "@/features/generateLLM/types";
import { callOpenAI } from "./llmService";
import { apiLogger } from "@/services/logging/apiLogger";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const MODEL_NAME = process.env.OPENAI_MODEL || "gpt-4";
const MAX_TOKENS = process.env.OPENAI_MAX_TOKENS
  ? parseInt(process.env.OPENAI_MAX_TOKENS)
  : undefined;
const TEMPERATURE = process.env.OPENAI_TEMPERATURE
  ? parseFloat(process.env.OPENAI_TEMPERATURE)
  : undefined;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ItineraryGenerationRequest {
  destination: string;
  startDate: string;
  endDate: string;
  interests: string[];
  travelStyle: string;
  transportPreference?: string;
  additionalNotes?: string;
}

// Re-export types for backward compatibility
export type {
  PlaceLocation,
  ItineraryDay,
  GeneratedItinerary,
} from "@/features/generateLLM/types";

export async function generateItineraryStream(
  request: ItineraryGenerationRequest
): Promise<ReadableStream<string>> {
  const {
    destination,
    startDate,
    endDate,
    interests,
    travelStyle,
    transportPreference,
    additionalNotes,
  } = request;

  const totalDays =
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000 +
    1;

  // Create the prompt for OpenAI
  const prompt = createItineraryPrompt({
    destination,
    startDate,
    endDate,
    totalDays,
    interests,
    travelStyle,
    transportPreference,
    additionalNotes,
  });

  const startTime = Date.now();

  const completionParams: any = {
    model: MODEL_NAME,
    messages: [
      {
        role: "system",
        content:
          "You are a professional travel planner. Create detailed, practical itineraries with specific places, realistic timing, and helpful descriptions. Always include approximate latitude and longitude coordinates for each place.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  };

  if (TEMPERATURE !== undefined) {
    completionParams.temperature = TEMPERATURE;
  }

  if (MAX_TOKENS !== undefined) {
    if (MODEL_NAME.startsWith("gpt-4")) {
      completionParams.max_tokens = MAX_TOKENS;
    } else {
      completionParams.max_completion_tokens = MAX_TOKENS;
    }
  }

  try {
    const stream = await openai.chat.completions.create({
      ...completionParams,
      stream: true,
    });

    return new ReadableStream<string>({
      async start(controller) {
        let fullResponse = "";

        try {
          for await (const chunk of stream as any) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              fullResponse += content;

              controller.enqueue(content);
            }
          }

          const duration = Date.now() - startTime;

          // Log successful streaming call
          apiLogger.logOpenAICall({
            model: MODEL_NAME,
            prompt,
            response: fullResponse,
            duration,
            status: "success",
            fromCache: false,
          });

          controller.close();
        } catch (streamError) {
          const duration = Date.now() - startTime;
          console.error("❌ Streaming error:", streamError);

          apiLogger.logOpenAICall({
            model: MODEL_NAME,
            prompt,
            duration,
            status: "error",
            fromCache: false,
            error:
              streamError instanceof Error
                ? streamError.message
                : String(streamError),
          });

          controller.error(streamError);
        }
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    apiLogger.logOpenAICall({
      model: MODEL_NAME,
      prompt,
      duration,
      status: "error",
      fromCache: false,
      error: error instanceof Error ? error.message : String(error),
    });

    console.error("Error creating streaming itinerary:", error);

    // Instead of throwing, return a ReadableStream that signals failure
    // This allows the caller to handle fallback gracefully
    return new ReadableStream({
      start(controller) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown streaming error";
        controller.enqueue(`STREAMING_FAILED: ${errorMessage}`);
        controller.close();
      },
    });
  }
}

export async function generateItinerary(
  request: ItineraryGenerationRequest
): Promise<GeneratedItinerary> {
  const {
    destination,
    startDate,
    endDate,
    interests,
    travelStyle,
    transportPreference,
    additionalNotes,
  } = request;

  const totalDays =
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000 +
    1;

  // Create the prompt for OpenAI
  const prompt = createItineraryPrompt({
    destination,
    startDate,
    endDate,
    totalDays,
    interests,
    travelStyle,
    transportPreference,
    additionalNotes,
  });

  console.log("prompt", prompt);

  try {
    // Use the generalized OpenAI service
    const response = await callOpenAI(prompt);

    // Parse the OpenAI response into structured data
    const parsedItinerary = parseItineraryResponse(
      response,
      destination,
      startDate,
      totalDays
    );
    console.log("parsedItinerary", JSON.stringify(parsedItinerary, null, 2));

    // Enrich places with Google Places API data
    const enrichedItinerary = await enrichPlacesWithGoogleData(parsedItinerary);
    console.log("enrichedItinerary", enrichedItinerary);

    return enrichedItinerary;
  } catch (error) {
    console.error("Error generating itinerary with OpenAI:", error);
    throw new Error("Failed to generate itinerary");
  }
}
