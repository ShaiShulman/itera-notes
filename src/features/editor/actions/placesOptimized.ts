"use server";

import { googlePlacesService } from "@/services/google/places";
// import type { PlaceSearchResult, PlaceDetails } from "../types";

/**
 * Cost-optimized place actions that minimize expensive API calls
 */

/**
 * Lightweight place validation using free Text Search only
 * Use this before expensive Place Details calls
 */
export async function validatePlaceExists(placeName: string): Promise<{
  exists: boolean;
  placeId?: string;
}> {
  try {
    if (!placeName || placeName.trim().length < 2) {
      return { exists: false };
    }

    // Use Text Search only (lower cost than Place Details)
    const results = await googlePlacesService.searchPlaces(placeName.trim());
    
    if (results.length === 0) {
      return { exists: false };
    }

    return {
      exists: true,
      placeId: results[0].place_id
    };
  } catch (error) {
    console.error("Place validation error:", error);
    return { exists: false };
  }
}

/**
 * Smart place enrichment that uses validation first
 */
export async function findPlaceSmartAction(placeName: string): Promise<{
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
    costLevel: 'free' | 'basic' | 'premium';
  };
  error?: string;
  suggestion?: 'upgrade_to_full';
}> {
  try {
    // Step 1: Check if place exists (cheap Text Search)
    const validation = await validatePlaceExists(placeName);
    
    if (!validation.exists || !validation.placeId) {
      return { success: false, error: "Place not found" };
    }

    // Step 2: Get basic details plus photos (since place exists)
    const placeDetails = await googlePlacesService.getPlaceDetails(
      validation.placeId,
      ['BASIC', 'PHOTOS']
    );

    if (!placeDetails) {
      return { success: false, error: "Could not fetch place details" };
    }

    // Extract 3 photos for better visual experience
    const photoReferences = (placeDetails.photos || [])
      .slice(0, 3)
      .map((photo) => photo.photo_reference);

    const thumbnailUrl = placeDetails.photos && placeDetails.photos.length > 0
      ? placeDetails.photos[0].photo_reference
      : undefined;

    const result = {
      success: true,
      place: {
        placeId: placeDetails.place_id,
        name: placeDetails.name,
        address: placeDetails.formatted_address,
        lat: placeDetails.geometry.location.lat,
        lng: placeDetails.geometry.location.lng,
        photoReferences,
        thumbnailUrl,
        costLevel: 'basic' as const,
      },
    };

    // Suggest upgrade for places that might benefit from premium data
    const isPopularPlace = placeDetails.types?.some(type => 
      ['tourist_attraction', 'restaurant', 'lodging', 'museum'].includes(type)
    );

    if (isPopularPlace) {
      return {
        ...result,
        suggestion: 'upgrade_to_full'
      };
    }

    return result;
  } catch (error) {
    console.error("Smart place action error:", error);
    return { success: false, error: "Search failed" };
  }
}

/**
 * Get premium place data (ratings, reviews, contact) - use sparingly
 */
export async function getPlacePremiumDataAction(placeId: string): Promise<{
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  description?: string;
  phone?: string;
  website?: string;
  openingHours?: any;
}> {
  try {
    // Get atmosphere + contact data (+$8/1K total cost)
    const details = await googlePlacesService.getPlaceDetails(
      placeId, 
      ['ATMOSPHERE', 'CONTACT']
    );

    if (!details) {
      return {};
    }

    return {
      rating: details.rating,
      userRatingsTotal: details.user_ratings_total,
      priceLevel: details.price_level,
      description: details.editorial_summary?.overview,
      phone: details.formatted_phone_number,
      website: details.website,
      openingHours: details.opening_hours,
    };
  } catch (error) {
    console.error("Premium place data error:", error);
    return {};
  }
}