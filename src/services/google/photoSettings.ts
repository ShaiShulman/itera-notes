/**
 * Photo Settings Configuration
 * Central configuration for photo sizes and processing settings
 */

export const PHOTO_SETTINGS = {
  // Master size for Google API calls - all photos fetched at this size
  MASTER_SIZE: 500,
  
  // Display sizes - these will be generated via server-side resizing
  MICRO_SIZE: 64,         // Very small thumbnails (for inline components)
  THUMBNAIL_SIZE: 150,    // Small thumbnails in collapsed view (24x24px display)  
  DEFAULT_SIZE: 250,      // Default size for photo display
  POPUP_SIZE: 400,        // Large size for photo popups/previews
  
  // Size validation - min and max allowed sizes
  MIN_SIZE: 32,           // Minimum allowed size
  MAX_SIZE: 800,          // Maximum allowed size
  
  // Cache settings
  CACHE_TTL_HOURS: 24 * 90, // 90 days cache TTL for photos
  
  // Image processing settings
  IMAGE_QUALITY: 85,      // JPEG quality (0-100)
  IMAGE_FORMAT: 'jpeg' as const, // Output format for resized images
  
  // API settings
  MAX_PHOTOS_PER_PLACE: 3, // Maximum photos to extract per place
  
  // Error handling
  MAX_RESIZE_ATTEMPTS: 2,  // Max attempts for image resizing
  RESIZE_TIMEOUT_MS: 5000, // Timeout for resize operations
} as const;

// Type definitions for photo settings
export type PhotoSize = 'micro' | 'thumbnail' | 'default' | 'popup' | 'master';

export type PhotoSizeMap = {
  micro: typeof PHOTO_SETTINGS.MICRO_SIZE;
  thumbnail: typeof PHOTO_SETTINGS.THUMBNAIL_SIZE;
  default: typeof PHOTO_SETTINGS.DEFAULT_SIZE;
  popup: typeof PHOTO_SETTINGS.POPUP_SIZE;
  master: typeof PHOTO_SETTINGS.MASTER_SIZE;
};

// Helper function to get size value by name
export function getPhotoSize(size: PhotoSize): number {
  switch (size) {
    case 'micro':
      return PHOTO_SETTINGS.MICRO_SIZE;
    case 'thumbnail':
      return PHOTO_SETTINGS.THUMBNAIL_SIZE;
    case 'default':
      return PHOTO_SETTINGS.DEFAULT_SIZE;
    case 'popup':
      return PHOTO_SETTINGS.POPUP_SIZE;
    case 'master':
      return PHOTO_SETTINGS.MASTER_SIZE;
    default:
      return PHOTO_SETTINGS.DEFAULT_SIZE;
  }
}

// Helper function to determine if resize is needed
export function shouldResize(requestedSize: number): boolean {
  return requestedSize !== PHOTO_SETTINGS.MASTER_SIZE;
}

// Helper function to validate photo size - now accepts any size within range
export function isValidPhotoSize(size: number): boolean {
  return size >= PHOTO_SETTINGS.MIN_SIZE && size <= PHOTO_SETTINGS.MAX_SIZE && Number.isInteger(size);
}

// Helper function to check if a size is a preset size
export function isPresetPhotoSize(size: number): size is typeof PHOTO_SETTINGS.MICRO_SIZE | typeof PHOTO_SETTINGS.THUMBNAIL_SIZE | typeof PHOTO_SETTINGS.DEFAULT_SIZE | typeof PHOTO_SETTINGS.POPUP_SIZE | typeof PHOTO_SETTINGS.MASTER_SIZE {
  const presetSizes = [
    PHOTO_SETTINGS.MICRO_SIZE,
    PHOTO_SETTINGS.THUMBNAIL_SIZE,
    PHOTO_SETTINGS.DEFAULT_SIZE,
    PHOTO_SETTINGS.POPUP_SIZE,
    PHOTO_SETTINGS.MASTER_SIZE,
  ] as const;
  return (presetSizes as readonly number[]).includes(size);
}

export default PHOTO_SETTINGS;