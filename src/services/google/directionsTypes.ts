// Google Directions API types

export interface DirectionsStep {
  distance: {
    text: string;
    value: number; // meters
  };
  duration: {
    text: string;
    value: number; // seconds
  };
  start_location: {
    lat: number;
    lng: number;
  };
  end_location: {
    lat: number;
    lng: number;
  };
  travel_mode: string; // "DRIVING", "WALKING", "BICYCLING", "TRANSIT"
  html_instructions: string;
  polyline: {
    points: string; // encoded polyline for this step
  };
}

export interface DirectionsLeg {
  distance: {
    text: string;
    value: number; // meters
  };
  duration: {
    text: string;
    value: number; // seconds
  };
  start_location: {
    lat: number;
    lng: number;
  };
  end_location: {
    lat: number;
    lng: number;
  };
  travel_mode?: string; // "DRIVING", "WALKING", "BICYCLING", "TRANSIT"
  steps?: DirectionsStep[]; // Optional for fallback straight-line responses
}

export interface DirectionsRoute {
  legs: DirectionsLeg[];
  overview_polyline: {
    points: string;
  };
}

export interface DirectionsResponse {
  routes: DirectionsRoute[];
  status: string;
  request?: {
    origin: { lat: number; lng: number } | string;
    destination: { lat: number; lng: number } | string;
    waypoints?: Array<{ location: { lat: number; lng: number } | string }>;
    travelMode: string;
    unitSystem: string;
    avoidHighways?: boolean;
    avoidTolls?: boolean;
  };
  available_travel_modes?: string[];
  geocoded_waypoints?: Array<{
    geocoder_status: string;
    place_id: string;
    types: string[];
  }>;
  // Flag to indicate this is a fallback response with straight lines
  isFallbackStraightLine?: boolean;
}

export interface PlaceCoordinate {
  lat: number;
  lng: number;
  uid?: string;
  name: string;
}