export interface PlaceLocation {
  name: string;
  lat: number;
  lng: number;
  paragraph?: string; // Description text from the itinerary
  shortName?: string; // Shortened name extracted from [[]] format
  linkedParagraphId?: string; // ID of linked paragraph for sync editing
  // Enhanced data from Google Places API
  placeId?: string;
  address?: string;
  rating?: number;
  photoReferences?: string[];
  description?: string;
  thumbnailUrl?: string;
  status?: "loading" | "found" | "error" | "free-text" | "idle";
  type?: "place" | "hotel"; // Type of place - used to determine which block to create
  // Driving directions data
  drivingTimeFromPrevious?: number; // Duration in minutes from previous place
  drivingDistanceFromPrevious?: number; // Distance in meters from previous place
}

export interface ItineraryDay {
  dayNumber: number;
  date: string;
  title: string;
  description: string;
  region?: string;
  transportMode?: string;
  places: PlaceLocation[];
}

export interface GeneratedItinerary {
  title: string;
  destination: string;
  totalDays: number;
  days: ItineraryDay[];
}

// Streaming-related types
export interface StreamingState {
  isStreaming: boolean;
  streamingLines: PreviewLine[];
  error?: string;
}

export interface PreviewLine {
  type: "title" | "day" | "place" | "paragraph" | "unknown";
  content: string;
  cleanedContent: string;
  metadata?: {
    dayNumber?: number;
    date?: string;
    placeName?: string;
    coordinates?: { lat: number; lng: number };
    region?: string;
    transportMode?: string;
  };
}

// Skeleton generation types (Step 1)
export interface SkeletonPlace {
  name: string;
  lat: number;
  lng: number;
  description: string; // Brief description from skeleton
  activities: string;
  time: string; // How long to spend
  transit?: string; // How to get to next place
  interestingFacts?: string[]; // 2 facts from skeleton generation
}

export interface SkeletonDay {
  dayNumber: number;
  date: string;
  title: string;
  transportMode: string;
  places: SkeletonPlace[];
}

export interface SkeletonItinerary {
  title: string;
  destination: string;
  totalDays: number;
  days: SkeletonDay[];
}

// Enrichment progress types
export interface EnrichmentProgress {
  type: "skeleton_generating" | "skeleton_generated" | "place_enriching" | "place_enriched" | "statistics";
  placeName?: string;
  found?: boolean;
  index?: number;
  total?: number;
  foundCount?: number;
  totalCount?: number;
  placesCount?: number;
}
