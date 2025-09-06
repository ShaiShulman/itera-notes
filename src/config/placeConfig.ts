/**
 * Configuration for place-related settings across the application
 */

export const PLACE_CONFIG = {
  // Maximum number of photos to display/use for places
  MAX_PHOTOS: 2,
  
  // Maximum number of photos to fetch from Google Places API
  MAX_PHOTOS_FETCH: 3, // Fetch one extra in case one fails to load
  
  // Photo sizes for different contexts
  PHOTO_SIZES: {
    THUMBNAIL: 24,
    POPUP: 400,
    GRID: 80,
  },
} as const;