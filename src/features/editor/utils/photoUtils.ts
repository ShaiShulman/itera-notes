/**
 * Utility functions for photo URL handling
 */

/**
 * Convert a Google Places photo reference to our API URL
 */
export function getPlacePhotoUrl(
  photoReference: string,
  maxWidth: number = 400
): string {
  try {
    // Return API URL instead of direct Google URL
    return `/api/places/photos/${photoReference}?width=${maxWidth}`;
  } catch (error) {
    console.error("Get place photo URL error:", error);
    return "";
  }
}