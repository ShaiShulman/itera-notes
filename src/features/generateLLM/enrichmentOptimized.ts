import { findPlaceByNameAction } from "@/features/editor/actions/places";
import { GeneratedItinerary } from "./types";
import { calculateStraightLineDistance } from "@/utils/distance";

/**
 * Optimized place enrichment that loads essential data immediately:
 * 1. Using basic field profiles (coordinates, address, photos)
 * 2. Skipping expensive fields (ratings, reviews) 
 * 3. Always includes thumbnails for immediate display
 */

export interface EnrichmentOptions {
  // Maximum places to enrich per day (cost control)
  maxEnrichPerDay?: number;
  // Whether to include all available photos or just thumbnail
  includeAllPhotos: boolean;
}

/**
 * Enrichment with essential data (coordinates, address, thumbnails) loaded immediately
 */
export async function enrichPlacesBasic(
  itinerary: GeneratedItinerary,
  options: EnrichmentOptions = {
    maxEnrichPerDay: undefined, // No limit by default
    includeAllPhotos: true
  }
): Promise<GeneratedItinerary> {
  console.log("🔍 Starting place enrichment with immediate thumbnail loading");

  const enrichedDays = await Promise.all(
    itinerary.days.map(async (day) => {
      console.log(`🔍 Enriching places for day ${day.dayNumber}`);

      // Apply limit if specified
      const placesToEnrich = options.maxEnrichPerDay 
        ? day.places.slice(0, options.maxEnrichPerDay)
        : day.places;
      
      const remainingPlaces = options.maxEnrichPerDay 
        ? day.places.slice(options.maxEnrichPerDay)
        : [];

      const enrichedPlaces = await Promise.all(
        placesToEnrich.map(async (place) => {
          try {
            const currentRegion = day.region || "";
            const searchQuery = currentRegion
              ? `${place.name}, ${currentRegion}`
              : place.name;

            console.log(`🔍 Enriching with essential data: ${searchQuery}`);

            const result = await findPlaceByNameAction(searchQuery);

            if (result.success && result.place) {
              const distance = calculateStraightLineDistance(
                place.lat,
                place.lng,
                result.place.lat,
                result.place.lng
              );

              const distanceKm = distance / 1000;
              const MAX_DISTANCE_KM = 150;

              if (distanceKm <= MAX_DISTANCE_KM) {
                return {
                  ...place,
                  placeId: result.place.placeId,
                  address: result.place.address,
                  lat: result.place.lat,
                  lng: result.place.lng,
                  // Always include photos for thumbnail display
                  photoReferences: result.place.photoReferences,
                  thumbnailUrl: result.place.thumbnailUrl,
                  status: "found" as const,
                };
              } else {
                return {
                  ...place,
                  placeId: result.place.placeId,
                  address: result.place.address,
                  // Always include photos for thumbnail display
                  photoReferences: result.place.photoReferences,
                  thumbnailUrl: result.place.thumbnailUrl,
                  status: "found" as const,
                };
              }
            } else {
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
        places: [...enrichedPlaces, ...remainingPlaces],
      };
    })
  );

  console.log("✅ Place enrichment with thumbnails completed");

  return {
    ...itinerary,
    days: enrichedDays,
  };
}

/**
 * Enrich a single place with expensive data (ratings, reviews) on demand
 */
export async function enrichPlaceWithRatings(
  place: any
): Promise<any> {
  console.log(`🔍 Loading ratings and reviews for: ${place.name}`);
  
  try {
    if (!place.placeId) {
      console.warn(`No placeId available for ${place.name}`);
      return place;
    }

    const { googlePlacesService } = await import("@/services/google/places");
    
    // Get atmosphere data for ratings/reviews (+$5/1K)
    const fullDetails = await googlePlacesService.getAtmospherePlaceDetails(
      place.placeId
    );
    
    if (fullDetails) {
      return {
        ...place,
        rating: fullDetails.rating,
        userRatingsTotal: fullDetails.user_ratings_total,
        priceLevel: fullDetails.price_level,
        editorialSummary: fullDetails.editorial_summary?.overview,
        reviews: fullDetails.reviews,
        status: "fully-enriched" as const,
      };
    }
    
    return place;
  } catch (error) {
    console.error(`❌ Error loading ratings for ${place.name}:`, error);
    return place;
  }
}