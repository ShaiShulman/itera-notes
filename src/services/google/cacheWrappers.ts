/**
 * Cache wrapper functions for Google APIs
 * These functions encapsulate the caching logic and provide a clean interface
 * for services to use caching without exposing cache implementation details
 */

import {
  googleAPICache,
  CACHE_TTL,
  generateDirectionsKey,
  generatePlacesKey,
} from "./cache";

/**
 * Cache wrapper for directions API calls
 */
export async function withDirectionsCache<T>(
  places: Array<{ lat: number; lng: number; name?: string }>,
  mode: string = "driving",
  apiCall: () => Promise<T>
): Promise<T> {
  const key = generateDirectionsKey(places, mode);
  const route = places.map((p) => p.name || `${p.lat},${p.lng}`).join(" → ");

  // Check cache first
  const cached = googleAPICache.get<T>(key);
  if (cached !== undefined) {
    console.log(`🗺️ DIRECTIONS (CACHED): ${route} [${mode}]`);
    return cached;
  }

  // Call API and cache result
  console.log(`🗺️ DIRECTIONS (API): ${route} [${mode}]`);
  const result = await apiCall();
  googleAPICache.set(key, result, CACHE_TTL.DIRECTIONS);
  return result;
}

/**
 * Cache wrapper for places search API calls
 */
export async function withPlacesSearchCache<T>(
  query: string,
  apiCall: () => Promise<T>
): Promise<T> {
  const key = generatePlacesKey("search", query);

  // Check cache first
  const cached = googleAPICache.get<T>(key);
  if (cached !== undefined) {
    console.log(`📍 PLACES SEARCH (CACHED): "${query}"`);
    return cached;
  }

  // Call API and cache result
  console.log(`📍 PLACES SEARCH (API): "${query}"`);
  const result = await apiCall();
  googleAPICache.set(key, result, CACHE_TTL.PLACES_SEARCH);
  return result;
}

/**
 * Cache wrapper for places details API calls
 */
export async function withPlaceDetailsCache<T>(
  placeId: string,
  apiCall: () => Promise<T>
): Promise<T> {
  const key = generatePlacesKey("details", placeId);

  // Check cache first
  const cached = googleAPICache.get<T>(key);
  if (cached !== undefined) {
    console.log(`🏢 PLACE DETAILS (CACHED): ${placeId}`);
    return cached;
  }

  // Call API and cache result
  console.log(`🏢 PLACE DETAILS (API): ${placeId}`);
  const result = await apiCall();
  googleAPICache.set(key, result, CACHE_TTL.PLACES_DETAILS);
  return result;
}

/**
 * Cache wrapper for place photos API calls
 */
export async function withPlacePhotosCache(
  photoReference: string,
  maxWidth: number,
  apiCall: () => Promise<string>
): Promise<string> {
  const key = generatePlacesKey("photos", photoReference, maxWidth.toString());

  // Check cache first
  const cached = googleAPICache.get<string>(key);
  if (cached !== undefined) {
    console.log(
      `📸 PLACE PHOTO (CACHED): ${photoReference.slice(
        0,
        5
      )}...${photoReference.slice(-5)}} (${maxWidth}px)`
    );
    return cached;
  }

  // Call API and cache result
  console.log(
    `📸 PLACE PHOTO (CACHED): ${photoReference.slice(
      0,
      5
    )}...${photoReference.slice(-5)}} (${maxWidth}px)`
  );
  const result = await apiCall();
  googleAPICache.set(key, result, CACHE_TTL.PLACES_PHOTOS);
  return result;
}
