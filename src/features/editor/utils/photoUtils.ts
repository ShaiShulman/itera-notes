/**
 * Utility functions for photo URL handling with server-side resizing
 */

import { PHOTO_SETTINGS, getPhotoSize, isValidPhotoSize, type PhotoSize } from "@/services/google/photoSettings";

/**
 * Convert a Google Places photo reference to our API URL with specified size
 * Supports named sizes (thumbnail, default, popup) or custom width
 */
export function getPlacePhotoUrl(
  photoReference: string,
  size: PhotoSize | number = 'default'
): string {
  try {
    const width = typeof size === 'string' ? getPhotoSize(size) : size;
    
    // Validate that the width is one of our supported sizes
    if (!isValidPhotoSize(width)) {
      console.warn(`Invalid photo width ${width}px, using default (${PHOTO_SETTINGS.DEFAULT_SIZE}px)`);
      return `/api/places/photos/${photoReference}?width=${PHOTO_SETTINGS.DEFAULT_SIZE}`;
    }
    
    return `/api/places/photos/${photoReference}?width=${width}`;
  } catch (error) {
    console.error("Get place photo URL error:", error);
    return "";
  }
}

/**
 * Get micro URL (64px) - for very small inline thumbnails
 */
export function getPlacePhotoMicroUrl(photoReference: string): string {
  return getPlacePhotoUrl(photoReference, 'micro');
}

/**
 * Get thumbnail URL (150px)
 */
export function getPlacePhotoThumbnailUrl(photoReference: string): string {
  return getPlacePhotoUrl(photoReference, 'thumbnail');
}

/**
 * Get popup/preview URL (400px)  
 */
export function getPlacePhotoPopupUrl(photoReference: string): string {
  return getPlacePhotoUrl(photoReference, 'popup');
}

/**
 * Get master size URL (500px)
 */
export function getPlacePhotoMasterUrl(photoReference: string): string {
  return getPlacePhotoUrl(photoReference, 'master');
}