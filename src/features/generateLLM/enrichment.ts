import { findPlaceByNameAction } from "@/features/editor/actions/places";
import { GeneratedItinerary } from "./types";

export async function enrichPlacesWithGoogleData(
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
