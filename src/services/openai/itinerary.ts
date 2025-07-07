import OpenAI from "openai";
import { findPlaceByNameAction } from "@/features/editor/actions/places";

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

export interface PlaceLocation {
  name: string;
  lat: number;
  lng: number;
  // Enhanced data from Google Places API
  placeId?: string;
  address?: string;
  rating?: number;
  photoReferences?: string[];
  description?: string;
  thumbnailUrl?: string;
  status?: "loading" | "found" | "error" | "free-text" | "idle";
}

export interface ItineraryDay {
  dayNumber: number;
  date: string;
  title: string;
  description: string;
  places: PlaceLocation[];
}

export interface GeneratedItinerary {
  title: string;
  destination: string;
  totalDays: number;
  days: ItineraryDay[];
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

async function enrichPlacesWithGoogleData(
  itinerary: GeneratedItinerary
): Promise<GeneratedItinerary> {
  console.log("🔍 Starting place enrichment with Google Places API");

  const enrichedDays = await Promise.all(
    itinerary.days.map(async (day) => {
      console.log(
        `🔍 Enriching ${day.places.length} places for day ${day.dayNumber}`
      );

      const enrichedPlaces = await Promise.all(
        day.places.map(async (place) => {
          try {
            console.log(`🔍 Searching for place: ${place.name}`);

            const result = await findPlaceByNameAction(place.name);

            if (result.success && result.place) {
              console.log(`✅ Found Google Places data for: ${place.name}`);
              return {
                ...place,
                placeId: result.place.placeId,
                address: result.place.address,
                rating: result.place.rating,
                photoReferences: result.place.photoReferences,
                description: result.place.description,
                thumbnailUrl: result.place.thumbnailUrl,
                status: "found" as const,
              };
            } else {
              console.log(
                `⚠️ Google Places data not found for: ${place.name}, keeping as free text`
              );
              return {
                ...place,
                status: "free-text" as const,
              };
            }
          } catch (error) {
            console.error(`❌ Error enriching place ${place.name}:`, error);
            return {
              ...place,
              status: "error" as const,
            };
          }
        })
      );

      return {
        ...day,
        places: enrichedPlaces,
      };
    })
  );

  console.log("✅ Place enrichment completed");

  return {
    ...itinerary,
    days: enrichedDays,
  };
}

function createItineraryPrompt({
  destination,
  startDate,
  endDate,
  totalDays,
  interests,
  travelStyle,
  additionalNotes,
}: {
  destination: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  interests: string[];
  travelStyle: string;
  additionalNotes?: string;
}): string {
  return `Create a detailed ${totalDays}-day travel itinerary for ${destination} from ${startDate} to ${endDate}.

Travel Style: ${travelStyle}
Interests: ${interests.join(", ")}
${additionalNotes ? `Additional Notes: ${additionalNotes}` : ""}

Please format your response EXACTLY as follows:

ITINERARY TITLE: [Creative title for the trip]

DAY 1 - [Date: YYYY-MM-DD] - [Day Title]
[Brief day description]

**[Place Name 1]** (lat: XX.XXXXX, lng: XX.XXXXX)
[Description of the place and activities]

**[Place Name 2]** (lat: XX.XXXXX, lng: XX.XXXXX)
[Description of the place and activities]

DAY 2 - [Date: YYYY-MM-DD] - [Day Title]
[Brief day description]

**[Place Name 3]** (lat: XX.XXXXX, lng: XX.XXXXX)
[Description of the place and activities]

Continue this format for all ${totalDays} days.

Requirements:
- Include 2-4 places per day
- Provide realistic latitude and longitude coordinates (5 decimal places)
- Each place name must be wrapped in **double asterisks**
- Include specific place names (restaurants, museums, attractions, etc.)
- Consider travel time between locations
- Match the ${travelStyle} budget and style
- Focus on the traveler's interests: ${interests.join(", ")}
- Provide practical, actionable recommendations
- Include opening hours and practical tips when relevant
- Each day should have a thematic focus when possible`;
}

function parseItineraryResponse(
  response: string,
  destination: string,
  startDate: string,
  totalDays: number
): GeneratedItinerary {
  const lines = response
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Extract title
  const titleLine = lines.find((line) =>
    line.toUpperCase().includes("ITINERARY TITLE:")
  );
  const title = titleLine
    ? titleLine.split(":")[1]?.trim() || `${destination} Adventure`
    : `${destination} Adventure`;

  const days: ItineraryDay[] = [];
  let currentDay: ItineraryDay | null = null;
  let currentDayDescription = "";

  for (const line of lines) {
    // Check for day header: DAY X - Date - Title
    const dayMatch = line.match(/^DAY\s+(\d+)\s*-\s*(.+)/i);
    if (dayMatch) {
      // Save previous day if exists
      if (currentDay) {
        currentDay.description = currentDayDescription.trim();
        days.push(currentDay);
      }

      // Parse day info
      const dayNumber = parseInt(dayMatch[1]);
      const dayInfo = dayMatch[2];

      // Extract date and title
      const dateMatch = dayInfo.match(/(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch
        ? dateMatch[1]
        : calculateDateForDay(startDate, dayNumber - 1);

      const title = dayInfo
        .replace(/\d{4}-\d{2}-\d{2}/, "")
        .replace(/^-\s*/, "")
        .trim();

      currentDay = {
        dayNumber,
        date,
        title: title || `Day ${dayNumber}`,
        description: "",
        places: [],
      };
      currentDayDescription = "";
      continue;
    }

    // Check for place: **Place Name** (lat: XX.XXXXX, lng: XX.XXXXX)
    const placeMatch = line.match(
      /\*\*(.+?)\*\*\s*\(lat:\s*([-\d.]+),\s*lng:\s*([-\d.]+)\)/i
    );
    if (placeMatch && currentDay) {
      const placeName = placeMatch[1].trim();
      const lat = parseFloat(placeMatch[2]);
      const lng = parseFloat(placeMatch[3]);

      if (!isNaN(lat) && !isNaN(lng)) {
        currentDay.places.push({
          name: placeName,
          lat,
          lng,
        });
      }
      continue;
    }

    // Add to day description if we're in a day context and it's not a place
    if (
      currentDay &&
      !line.includes("**") &&
      !line.toUpperCase().includes("DAY")
    ) {
      currentDayDescription += line + " ";
    }
  }

  // Don't forget the last day
  if (currentDay) {
    currentDay.description = currentDayDescription.trim();
    days.push(currentDay);
  }

  // Fill in missing days if needed
  while (days.length < totalDays) {
    const dayNumber = days.length + 1;
    days.push({
      dayNumber,
      date: calculateDateForDay(startDate, dayNumber - 1),
      title: `Day ${dayNumber}`,
      description: "Free time to explore",
      places: [],
    });
  }

  return {
    title,
    destination,
    totalDays,
    days: days.slice(0, totalDays), // Ensure we don't exceed the requested days
  };
}

function calculateDateForDay(startDate: string, dayOffset: number): string {
  const date = new Date(startDate);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().split("T")[0];
}
