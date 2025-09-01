"use server";

import { googlePlacesService } from "@/services/google/places";
import type { PlaceSearchResult, PlaceDetails } from "../types";

export async function searchPlacesAction(
  query: string
): Promise<PlaceSearchResult[]> {
  try {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const results = await googlePlacesService.searchPlaces(query.trim());

    // Return top 5 results to keep it manageable
    return results.slice(0, 5);
  } catch (error) {
    console.error("Search places action error:", error);
    return [];
  }
}

export async function getPlaceDetailsAction(
  placeId: string,
  includeExpensiveFields: boolean = false
): Promise<PlaceDetails | null> {
  try {
    if (!placeId) {
      return null;
    }

    // Include basic info + photos by default for better user experience
    // Only use truly basic details if explicitly requested
    const details = includeExpensiveFields 
      ? await googlePlacesService.getPlaceDetails(placeId, ['ALL'])
      : await googlePlacesService.getPlaceDetails(placeId, ['BASIC', 'PHOTOS']);
    return details;
  } catch (error) {
    console.error("Get place details action error:", error);
    return null;
  }
}


export async function findPlaceByNameAction(placeName: string): Promise<{
  success: boolean;
  place?: {
    placeId: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    rating?: number;
    photoReferences: string[];
    description?: string;
    thumbnailUrl?: string;
  };
  error?: string;
}> {
  try {
    if (!placeName || placeName.trim().length < 2) {
      return { success: false, error: "Place name too short" };
    }

    const placeResult = await googlePlacesService.findPlaceByName(
      placeName.trim()
    );

    if (!placeResult) {
      return { success: false, error: "Place not found" };
    }

    // Get basic details plus photos for place enrichment
    const placeDetails = await googlePlacesService.getPlaceDetails(
      placeResult.place_id,
      ['BASIC', 'PHOTOS']
    );

    if (!placeDetails) {
      return { success: false, error: "Could not fetch place details" };
    }
    // Get photo references (not URLs) for client-side API calls - extract 3 for better visual experience
    const photoReferences = (placeDetails.photos || [])
      .slice(0, 3)
      .map((photo) => photo.photo_reference);

    // Get thumbnail reference for first photo
    const thumbnailUrl =
      placeDetails.photos && placeDetails.photos.length > 0
        ? placeDetails.photos[0].photo_reference
        : undefined;

    return {
      success: true,
      place: {
        placeId: placeDetails.place_id,
        name: placeDetails.name,
        address: placeDetails.formatted_address,
        lat: placeDetails.geometry.location.lat,
        lng: placeDetails.geometry.location.lng,
        rating: placeDetails.rating,
        photoReferences,
        description: placeDetails.editorial_summary?.overview,
        thumbnailUrl,
      },
    };
  } catch (error) {
    console.error("Find place by name action error:", error);
    return { success: false, error: "Search failed" };
  }
}
