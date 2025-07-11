import OpenAI from "openai";
import { createItineraryPrompt } from "@/features/generateLLM/promptBuilder";
import { parseItineraryResponse } from "@/features/generateLLM/responseParser";
import { enrichPlacesWithGoogleData } from "@/features/generateLLM/enrichment";
import { GeneratedItinerary } from "@/features/generateLLM/types";
import { apiLogger } from "@/services/logging/apiLogger";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ItineraryGenerationRequest {
  destination: string;
  startDate: string;
  endDate: string;
  interests: string[];
  travelStyle: string;
  additionalNotes?: string;
}

// Re-export types for backward compatibility
export type {
  PlaceLocation,
  ItineraryDay,
  GeneratedItinerary,
} from "@/features/generateLLM/types";

export async function generateItinerary(
  request: ItineraryGenerationRequest
): Promise<GeneratedItinerary> {
  const {
    destination,
    startDate,
    endDate,
    interests,
    travelStyle,
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
    additionalNotes,
  });

  console.log("prompt", prompt);
  const startTime = Date.now();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
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
      temperature: 0.7,
      max_tokens: 3000,
    });

    const response = completion.choices[0]?.message?.content;
    const duration = Date.now() - startTime;

    console.log("response", response);
    if (!response) {
      throw new Error("No response from OpenAI");
    }

    // Log successful OpenAI call
    apiLogger.logOpenAICall({
      model: "gpt-4",
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
    });

    // Parse the OpenAI response into structured data
    const parsedItinerary = parseItineraryResponse(
      response,
      destination,
      startDate,
      totalDays
    );
    console.log("parsedItinerary", parsedItinerary);

    // Enrich places with Google Places API data
    const enrichedItinerary = await enrichPlacesWithGoogleData(parsedItinerary);
    console.log("enrichedItinerary", enrichedItinerary);

    return enrichedItinerary;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Log failed OpenAI call
    apiLogger.logOpenAICall({
      model: "gpt-4",
      prompt,
      duration,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });

    console.error("Error generating itinerary with OpenAI:", error);
    throw new Error("Failed to generate itinerary");
  }
}
