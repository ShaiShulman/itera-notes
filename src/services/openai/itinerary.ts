import OpenAI from "openai";
import {
  createItineraryPrompt,
  parseItineraryResponse,
  enrichPlacesWithGoogleData,
  GeneratedItinerary,
} from "@/features/generateLLM";

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
} from "@/features/generateLLM";

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
    console.log("response", response);
    if (!response) {
      throw new Error("No response from OpenAI");
    }

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
    console.error("Error generating itinerary with OpenAI:", error);
    throw new Error("Failed to generate itinerary");
  }
}
