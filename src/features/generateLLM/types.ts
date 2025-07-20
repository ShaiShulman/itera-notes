export interface PlaceLocation {
  name: string;
  lat: number;
  lng: number;
  paragraph?: string; // Description text from the itinerary
  // Enhanced data from Google Places API
  placeId?: string;
  address?: string;
  rating?: number;
  photoReferences?: string[];
  description?: string;
  thumbnailUrl?: string;
  status?: "loading" | "found" | "error" | "free-text" | "idle";
  type?: "place" | "hotel"; // Type of place - used to determine which block to create
}

export interface ItineraryDay {
  dayNumber: number;
  date: string;
  title: string;
  description: string;
  places: PlaceLocation[];
}

export interface GeneratedItinerary {
  title: string;
  destination: string;
  totalDays: number;
  days: ItineraryDay[];
}
