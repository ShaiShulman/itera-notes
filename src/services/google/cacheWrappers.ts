/**
 * Cache wrapper functions for Google APIs
 * 
 * Provides caching for Google API endpoints with proper hit/miss detection:
 * 
 * - withDirectionsCache: Routes (7-day TTL)
 * - withPlacesSearchCache: Search queries (14-day TTL) 
 * - withPlaceDetailsCache: Place details (30-day TTL)
 * - withPlacePhotosCache: Photos (90-day TTL)
 * 
 * All functions return { result, fromCache } and handle legacy key formats.
 */

import {
  googleAPICache,
  CACHE_TTL,
  generateDirectionsKey,
  generatePlacesKey,
  generateLegacyPlacesKey,
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

  // Use the enhanced cache wrapper
  try {
    const result = await googleAPICache.withCache(key, async () => {
      console.log(`🗺️ DIRECTIONS (API): ${route} [${mode}]`);
      return await apiCall();
    }, CACHE_TTL.DIRECTIONS);

    // Check if it was from cache (if result was immediate)
    const wasFromCache = googleAPICache.has(key);
    if (wasFromCache) {
      console.log(`🗺️ DIRECTIONS (CACHED): ${route} [${mode}]`);
    }

    return { result, fromCache: wasFromCache };
  } catch (error) {
    // Fallback to direct API call if cache fails
    console.warn(`🗺️ DIRECTIONS (CACHE ERROR): ${route} [${mode}]`, error);
    const result = await apiCall();
    return { result, fromCache: false };
  }
}

/**
 * Cache wrapper for places search API calls
 */
export async function withPlacesSearchCache<T>(
  query: string,
  apiCall: () => Promise<T>
): Promise<{ result: T; fromCache: boolean }> {
  const key = generatePlacesKey("search", query);

  // Check cache with new key format first
  let cached = googleAPICache.get<T>(key);
  if (cached !== undefined) {
    console.log(`📍 PLACES SEARCH (CACHED): "${query}"`);
    return { result: cached, fromCache: true };
  }

  // Fallback: check cache with old key format for backward compatibility
  const legacyKey = generateLegacyPlacesKey("search", query);
  if (legacyKey !== key) {
    cached = googleAPICache.get<T>(legacyKey);
    if (cached !== undefined) {
      console.log(`📍 PLACES SEARCH (CACHED-LEGACY): "${query}"`);
      // Re-cache with new key format for future lookups
      googleAPICache.set(key, cached, CACHE_TTL.PLACES_SEARCH);
      return { result: cached, fromCache: true };
    }
  }

  // No cache hit - make API call and cache result
  try {
    console.log(`📍 PLACES SEARCH (API): "${query}"`);
    const result = await apiCall();
    googleAPICache.set(key, result, CACHE_TTL.PLACES_SEARCH);
    return { result, fromCache: false };
  } catch (error) {
    // Fallback to direct API call if cache fails
    console.warn(`📍 PLACES SEARCH (CACHE ERROR): "${query}"`, error);
    const result = await apiCall();
    return { result, fromCache: false };
  }
}

/**
 * Cache wrapper for places details API calls
 */
export async function withPlaceDetailsCache<T>(
  placeId: string,
  apiCall: () => Promise<T>
): Promise<{ result: T; fromCache: boolean }> {
  const key = generatePlacesKey("details", placeId);

  // Check cache with new key format first
  let cached = googleAPICache.get<T>(key);
  if (cached !== undefined) {
    console.log(`🏢 PLACE DETAILS (CACHED): ${placeId}`);
    return { result: cached, fromCache: true };
  }

  // Fallback: check cache with old key format for backward compatibility
  const legacyKey = generateLegacyPlacesKey("details", placeId);
  if (legacyKey !== key) {
    cached = googleAPICache.get<T>(legacyKey);
    if (cached !== undefined) {
      console.log(`🏢 PLACE DETAILS (CACHED-LEGACY): ${placeId}`);
      // Re-cache with new key format for future lookups
      googleAPICache.set(key, cached, CACHE_TTL.PLACES_DETAILS);
      return { result: cached, fromCache: true };
    }
  }

  // No cache hit - make API call and cache result
  try {
    console.log(`🏢 PLACE DETAILS (API): ${placeId}`);
    const result = await apiCall();
    googleAPICache.set(key, result, CACHE_TTL.PLACES_DETAILS);
    return { result, fromCache: false };
  } catch (error) {
    // Fallback to direct API call if cache fails
    console.warn(`🏢 PLACE DETAILS (CACHE ERROR): ${placeId}`, error);
    const result = await apiCall();
    return { result, fromCache: false };
  }
}

/**
 * Cache wrapper for place photos API calls
 * Now size-agnostic - caches master image only using optimized PhotoCache
 */
export async function withPlacePhotosCache(
  photoReference: string,
  apiCall: () => Promise<string>
): Promise<{ result: string; fromCache: boolean }> {
  const key = generatePlacesKey("photos", photoReference);
  const shortRef = `${photoReference.slice(0, 5)}...${photoReference.slice(-5)}`;

  // Check if item exists in cache BEFORE calling withCache
  const wasFromCache = googleAPICache.has(key);

  // Use the enhanced cache wrapper optimized for large photo data
  try {
    const result = await googleAPICache.withCache(key, async () => {
      console.log(`📸 PLACE PHOTO (API): ${shortRef} (master)`);
      return await apiCall();
    }, CACHE_TTL.PLACES_PHOTOS);

    // Log cache hit only if it was actually from cache
    if (wasFromCache) {
      console.log(`📸 PLACE PHOTO (CACHED): ${shortRef} (master)`);
    }

    return { result, fromCache: wasFromCache };
  } catch (error) {
    // Fallback to direct API call if cache fails
    console.warn(`📸 PLACE PHOTO (CACHE ERROR): ${shortRef}`, error);
    const result = await apiCall();
    return { result, fromCache: false };
  }
}
