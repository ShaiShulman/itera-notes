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
  placeId: string
): Promise<PlaceDetails | null> {
  try {
    if (!placeId) {
      return null;
    }

    const details = await googlePlacesService.getPlaceDetails(placeId);
    return details;
  } catch (error) {
    console.error("Get place details action error:", error);
    return null;
  }
}

export async function getPlacePhotoUrl(
  photoReference: string,
  maxWidth: number = 400
): Promise<string> {
  try {
    return googlePlacesService.getPhotoUrl(photoReference, maxWidth);
  } catch (error) {
    console.error("Get place photo URL error:", error);
    return "";
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

    // Get detailed information
    const placeDetails = await googlePlacesService.getPlaceDetails(
      placeResult.place_id
    );

    if (!placeDetails) {
      return { success: false, error: "Could not fetch place details" };
    }
    // Get photo URLs instead of photo references
    const photoReferences = (placeDetails.photos || [])
      .slice(0, 4)
      .map((photo) =>
        googlePlacesService.getPhotoUrl(photo.photo_reference, 400)
      );

    // Get thumbnail URL for first photo
    const thumbnailUrl =
      placeDetails.photos && placeDetails.photos.length > 0
        ? googlePlacesService.getPhotoUrl(
            placeDetails.photos[0].photo_reference,
            150
          )
        : undefined;

    return {
      success: true,
      place: {
        placeId: placeDetails.place_id,
        name: placeDetails.name,
        address: placeDetails.formatted_address,
        lat: typeof placeDetails.geometry.location.lat === 'function' 
          ? placeDetails.geometry.location.lat() 
          : placeDetails.geometry.location.lat,
        lng: typeof placeDetails.geometry.location.lng === 'function' 
          ? placeDetails.geometry.location.lng() 
          : placeDetails.geometry.location.lng,
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
