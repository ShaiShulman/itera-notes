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
): Promise<{ result: T; fromCache: boolean }> {
  const key = generateDirectionsKey(places, mode);
  const route = places.map((p) => p.name || `${p.lat},${p.lng}`).join(" → ");

  // Check cache first
  const cached = googleAPICache.get<T>(key);
  if (cached !== undefined) {
    console.log(`🗺️ DIRECTIONS (CACHED): ${route} [${mode}]`);
    return { result: cached, fromCache: true };
  }

  // Call API and cache result
  console.log(`🗺️ DIRECTIONS (API): ${route} [${mode}]`);
  const result = await apiCall();
  googleAPICache.set(key, result, CACHE_TTL.DIRECTIONS);
  return { result, fromCache: false };
}

/**
 * Cache wrapper for places search API calls
 */
export async function withPlacesSearchCache<T>(
  query: string,
  apiCall: () => Promise<T>
): Promise<{ result: T; fromCache: boolean }> {
  const key = generatePlacesKey("search", query);

  // Check cache first
  const cached = googleAPICache.get<T>(key);
  if (cached !== undefined) {
    console.log(`📍 PLACES SEARCH (CACHED): "${query}"`);
    return { result: cached, fromCache: true };
  }

  // Call API and cache result
  console.log(`📍 PLACES SEARCH (API): "${query}"`);
  const result = await apiCall();
  googleAPICache.set(key, result, CACHE_TTL.PLACES_SEARCH);
  return { result, fromCache: false };
}

/**
 * Cache wrapper for places details API calls
 */
export async function withPlaceDetailsCache<T>(
  placeId: string,
  apiCall: () => Promise<T>
): Promise<{ result: T; fromCache: boolean }> {
  const key = generatePlacesKey("details", placeId);

  // Check cache first
  const cached = googleAPICache.get<T>(key);
  if (cached !== undefined) {
    console.log(`🏢 PLACE DETAILS (CACHED): ${placeId}`);
    return { result: cached, fromCache: true };
  }

  // Call API and cache result
  console.log(`🏢 PLACE DETAILS (API): ${placeId}`);
  const result = await apiCall();
  googleAPICache.set(key, result, CACHE_TTL.PLACES_DETAILS);
  return { result, fromCache: false };
}

/**
 * Cache wrapper for place photos API calls
 * Now size-agnostic - caches master image only
 */
export async function withPlacePhotosCache(
  photoReference: string,
  apiCall: () => Promise<string>
): Promise<{ result: string; fromCache: boolean }> {
  const key = generatePlacesKey("photos", photoReference);

  // Check cache first
  const cached = googleAPICache.get<string>(key);
  if (cached !== undefined) {
    console.log(
      `📸 PLACE PHOTO (CACHED): ${photoReference.slice(
        0,
        5
      )}...${photoReference.slice(-5)} (master)`
    );
    return { result: cached, fromCache: true };
  }

  // Call API and cache result
  console.log(
    `📸 PLACE PHOTO (API): ${photoReference.slice(
      0,
      5
    )}...${photoReference.slice(-5)} (master)`
  );
  const result = await apiCall();
  googleAPICache.set(key, result, CACHE_TTL.PLACES_PHOTOS);
  return { result, fromCache: false };
}
