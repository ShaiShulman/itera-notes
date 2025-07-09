export interface PlaceSearchResult {
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

export interface PlaceDetails {
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
  opening_hours?: {
    open_now: boolean;
    weekday_text: string[];
  };
  types: string[];
  editorial_summary?: {
    overview: string;
  };
}

export interface DayBlockData {
  dayNumber: number;
  date?: string;
  title?: string;
}

export interface PlaceBlockData {
  uid?: string;
  placeId?: string;
  name?: string;
  address?: string;
  rating?: number;
  photoReferences?: string[];
  lat?: number;
  lng?: number;
  notes?: string;
  description?: string;
  thumbnailUrl?: string;
  status?: "idle" | "loading" | "found" | "error" | "free-text";
  drivingTimeFromPrevious?: number;
  drivingDistanceFromPrevious?: number;
}

export interface EditorBlockData {
  id?: string;
  type: string;
  data: Record<string, unknown>;
}

export interface EditorData {
  time?: number;
  blocks: EditorBlockData[];
  version?: string;
}

export interface ItineraryEditorProps {
  data?: EditorData;
  onChange?: (data: EditorData) => void;
  onRefreshReady?: (
    refreshFn: () => Promise<{
      directions: unknown[];
      updatedPlaces: PlaceBlockData[];
    }>
  ) => void;
  placeholder?: string;
  readOnly?: boolean;
}
