/**
 * Google Photos API service for handling place photos
 * Manages photo fetching, base64 conversion, and caching
 */

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
   * Fetch a photo from Google Places and convert to base64 data URL
   */
  async fetchPhotoAsBase64(
    photoReference: string,
    maxWidth: number = 400
  ): Promise<string> {
    try {
      const photoUrl = `${this.baseUrl}/place/photo?photoreference=${photoReference}&maxwidth=${maxWidth}&key=${this.apiKey}`;

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
    } catch (error) {
      console.error(`📸 Error fetching photo ${photoReference}:`, error);
      throw error;
    }
  }

  /**
   * Generate a direct photo URL (for comparison/debugging)
   * Note: These URLs expire and have rate limits
   */
  getDirectPhotoUrl(photoReference: string, maxWidth: number = 400): string {
    return `${this.baseUrl}/place/photo?photoreference=${photoReference}&maxwidth=${maxWidth}&key=${this.apiKey}`;
  }
}

export const googlePhotosService = new GooglePhotosService();
