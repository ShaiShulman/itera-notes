// Map feature types
export interface MapPlace {
  id: string;
  uid?: string; // Unique identifier for syncing with editor
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  dayIndex?: number; // Which day this place belongs to
  placeId?: string;
  thumbnailUrl?: string;
  placeNumberInDay?: number; // Position within the day (1, 2, 3...)
  color?: string; // Color for this specific place
  drivingTimeFromPrevious?: number; // Duration in minutes from previous place
  drivingDistanceFromPrevious?: number; // Distance in meters from previous place
}

export interface MapData {
  places: MapPlace[];
  directions?: DirectionsData[]; // New: directions for each day
  days: DayData[];
}

export interface DayData {
  index: number;
  title: string;
  date?: string;
  color: string;
}

export interface MapProps {
  data: MapData;
  onPlaceClick?: (place: MapPlace) => void;
  onMapReady?: (map: google.maps.Map) => void;
  onRefreshDirections?: () => Promise<void>;
  className?: string;
}

// Day colors - predefined set of colors for different days
export const DAY_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Yellow
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#F97316", // Orange
  "#06B6D4", // Cyan
  "#84CC16", // Lime
  "#EC4899", // Pink
  "#6B7280", // Gray
  "#14B8A6", // Teal
  "#F43F5E", // Rose
  "#8B5A3C", // Brown
  "#2563EB", // Indigo
  "#DC2626", // Dark Red
] as const;

export type DayColor = (typeof DAY_COLORS)[number];

// Google Maps integration types
export interface GoogleMapInstance {
  map: google.maps.Map;
  markers: google.maps.Marker[];
  directionsRenderers: google.maps.DirectionsRenderer[]; // New: track directions renderers
}

// Google Directions API response types
export interface DirectionsRoute {
  overview_polyline: {
    points: string; // Encoded polyline string
  };
  legs?: Array<{
    distance?: { text: string; value: number };
    duration?: { text: string; value: number };
    start_address?: string;
    end_address?: string;
  }>;
  summary?: string;
  warnings?: string[];
  waypoint_order?: number[];
}

export interface DirectionsResponse {
  routes: DirectionsRoute[];
  status: string;
  geocoded_waypoints?: Array<{
    geocoder_status: string;
    place_id?: string;
    types?: string[];
  }>;
}

// Directions data interface for rendering
export interface DirectionsData {
  dayIndex: number;
  color: string;
  directionsResult: DirectionsResponse;
}
