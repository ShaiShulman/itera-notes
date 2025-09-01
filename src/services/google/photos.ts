/**
 * Google Photos API service for handling place photos
 * Manages photo fetching at master size, base64 conversion, and caching
 * All photos are fetched at master size and resized on-demand
 */

import { apiLogger } from "@/services/logging/apiLogger";
import { withPlacePhotosCache } from "./cacheWrappers";
import { PHOTO_SETTINGS } from "./photoSettings";

class GooglePhotosService {
  private apiKey: string;
  private baseUrl = "https://maps.googleapis.com/maps/api";

  constructor() {
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("Google Places API key is not configured");
    }
  }

  /**
   * Fetch a photo from Google Places at master size and convert to base64 data URL
   * Always fetches at master size (500px) for optimal caching and quality
   */
  async fetchPhotoAsBase64(
    photoReference: string
  ): Promise<string> {
    const startTime = Date.now();
    const masterSize = PHOTO_SETTINGS.MASTER_SIZE;

    try {
      const { result: base64Data, fromCache } = await withPlacePhotosCache(
        photoReference,
        async () => {
          const photoUrl = `${this.baseUrl}/place/photo?photoreference=${photoReference}&maxwidth=${masterSize}&key=${this.apiKey}`;

          const response = await fetch(photoUrl);

          if (!response.ok) {
            throw new Error(`Photo API request failed: ${response.statusText}`);
          }

          // Get the image data as array buffer
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // Convert to base64 data URL
          const contentType = response.headers.get("content-type") || "image/jpeg";
          const base64Data = `data:${contentType};base64,${buffer.toString(
            "base64"
          )}`;

          return base64Data;
        }
      );

      const duration = Date.now() - startTime;
      
      // Extract content type and size info for logging
      const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      const contentType = matches?.[1];
      const base64Content = matches?.[2];
      const photoSizeBytes = base64Content ? Buffer.from(base64Content, "base64").length : undefined;

      // Log successful call
      apiLogger.logGooglePhotosCall({
        photoReference,
        maxWidth: masterSize,
        photoSizeBytes,
        contentType,
        duration,
        status: "success",
        fromCache,
      });

      return base64Data;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log failed call
      apiLogger.logGooglePhotosCall({
        photoReference,
        maxWidth: masterSize,
        duration,
        status: "error",
        fromCache: false,
        error: error instanceof Error ? error.message : String(error),
      });

      console.error(`📸 Error fetching photo ${photoReference}:`, error);
      throw error;
    }
  }

  /**
   * Generate a direct photo URL at master size (for comparison/debugging)
   * Note: These URLs expire and have rate limits
   */
  getDirectPhotoUrl(photoReference: string): string {
    return `${this.baseUrl}/place/photo?photoreference=${photoReference}&maxwidth=${PHOTO_SETTINGS.MASTER_SIZE}&key=${this.apiKey}`;
  }
}

export const googlePhotosService = new GooglePhotosService();
