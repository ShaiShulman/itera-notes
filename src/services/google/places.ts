interface PlaceSearchResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  price_level?: number;
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  types: string[];
}

interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  rating?: number;
  price_level?: number;
  user_ratings_total?: number;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  reviews?: Array<{
    author_name: string;
    rating: number;
    text: string;
    time: number;
  }>;
  opening_hours?: {
    open_now: boolean;
    weekday_text: string[];
  };
  types: string[];
  editorial_summary?: {
    overview: string;
  };
}

class GooglePlacesService {
  private apiKey: string;
  private baseUrl = "https://maps.googleapis.com/maps/api";

  constructor() {
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("Google Places API key is not configured");
    }
  }

  async searchPlaces(query: string): Promise<PlaceSearchResult[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/place/textsearch/json?query=${encodeURIComponent(
          query
        )}&key=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Places API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== "OK") {
        throw new Error(`Places API error: ${data.status}`);
      }

      return data.results || [];
    } catch (error) {
      console.error("Error searching places:", error);
      throw error;
    }
  }

  async findPlaceByName(placeName: string): Promise<PlaceSearchResult | null> {
    try {
      const results = await this.searchPlaces(placeName);
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error("Error finding place by name:", error);
      throw error;
    }
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    try {
      const fields = [
        "place_id",
        "name",
        "formatted_address",
        "formatted_phone_number",
        "international_phone_number",
        "website",
        "rating",
        "price_level",
        "user_ratings_total",
        "geometry",
        "photos",
        "opening_hours",
        "types",
        "editorial_summary",
      ].join(",");

      const response = await fetch(
        `${this.baseUrl}/place/details/json?place_id=${placeId}&fields=${fields}&key=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Place details request failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== "OK") {
        throw new Error(`Place details API error: ${data.status}`);
      }

      return data.result || null;
    } catch (error) {
      console.error("Error getting place details:", error);
      throw error;
    }
  }

  getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
    return `${this.baseUrl}/place/photo?photoreference=${photoReference}&maxwidth=${maxWidth}&key=${this.apiKey}`;
  }
}

export const googlePlacesService = new GooglePlacesService();
export type { PlaceSearchResult, PlaceDetails };
