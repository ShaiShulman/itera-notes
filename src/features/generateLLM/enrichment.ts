import { findPlaceByNameAction } from "@/features/editor/actions/places";
import { GeneratedItinerary } from "./types";
import { calculateStraightLineDistance } from "@/utils/distance";

export async function enrichPlacesWithGoogleData(
  itinerary: GeneratedItinerary
): Promise<GeneratedItinerary> {
  console.log("🔍 Starting place enrichment with Google Places API");

  const enrichedDays = await Promise.all(
    itinerary.days.map(async (day) => {
      console.log(
        `🔍 Enriching ${day.places.length} places for day ${day.dayNumber}`
      );
      
      // Use the day's region for context, or fallback to a generic region if not set
      const currentRegion = day.region || "";
      console.log(`🌍 Using region context for day ${day.dayNumber}: "${currentRegion}"`);

      const enrichedPlaces = await Promise.all(
        day.places.map(async (place) => {
          try {
            // Construct search query with region context if available
            const searchQuery = currentRegion 
              ? `${place.name}, ${currentRegion}`
              : place.name;
            
            console.log(`🔍 Searching for place: ${searchQuery}`);

            const result = await findPlaceByNameAction(searchQuery);

            if (result.success && result.place) {
              console.log(`✅ Found Google Places data for: ${place.name}`);
              
              // Calculate distance between original and Google Places coordinates
              const distance = calculateStraightLineDistance(
                place.lat,
                place.lng,
                result.place.lat,
                result.place.lng
              );
              
              const distanceKm = distance / 1000;
              console.log(`📏 Distance between original and Google Places coordinates: ${distanceKm.toFixed(2)} km`);
              
              // Check if distance is within acceptable range (150km)
              const MAX_DISTANCE_KM = 150;
              
              if (distanceKm <= MAX_DISTANCE_KM) {
                console.log(`✅ Distance validation passed for: ${place.name} (${distanceKm.toFixed(2)} km <= ${MAX_DISTANCE_KM} km)`);
                console.log(
                  `🔍 ENRICHMENT: "${place.name}" has paragraph: "${
                    place.paragraph || "NONE"
                  }"`
                );
                return {
                  ...place,
                  placeId: result.place.placeId,
                  address: result.place.address,
                  rating: result.place.rating,
                  lat: result.place.lat,
                  lng: result.place.lng,
                  photoReferences: result.place.photoReferences,
                  // Keep our parsed paragraph, don't overwrite with Google's description
                  description: place.paragraph || result.place.description,
                  thumbnailUrl: result.place.thumbnailUrl,
                  status: "found" as const,
                };
              } else {
                console.log(`⚠️ Distance validation failed for: ${place.name} (${distanceKm.toFixed(2)} km > ${MAX_DISTANCE_KM} km). Keeping original coordinates.`);
                return {
                  ...place,
                  // Keep original coordinates but add some Google Places metadata if available
                  placeId: result.place.placeId,
                  address: result.place.address,
                  rating: result.place.rating,
                  photoReferences: result.place.photoReferences,
                  description: place.paragraph || result.place.description,
                  thumbnailUrl: result.place.thumbnailUrl,
                  status: "found" as const,
                  // Keep original lat/lng from LLM generation
                };
              }
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
