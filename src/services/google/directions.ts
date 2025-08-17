// Google Directions API service
import { FallbackDirectionsService } from "./fallbackDirections";
import { withDirectionsCache } from "./cacheWrappers";

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

import { apiLogger } from "@/services/logging/apiLogger";

export interface PlaceCoordinate {
  lat: number;
  lng: number;
  uid?: string;
  name: string;
}

export class GoogleDirectionsService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Calculate driving directions between multiple places in order
   * @param places Array of places with coordinates
   * @returns Promise with directions data (real or fallback straight-line)
   */
  async calculateDirections(
    places: PlaceCoordinate[]
  ): Promise<DirectionsResponse> {
    if (places.length < 2) {
      throw new Error("At least 2 places are required to calculate directions");
    }

    const origin = places[0];
    const destination = places[places.length - 1];
    const waypoints = places.slice(1, -1);
    const startTime = Date.now();

    // Build the API URL
    const baseUrl = "https://maps.googleapis.com/maps/api/directions/json";
    const params = new URLSearchParams({
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      key: this.apiKey,
      mode: "driving",
      units: "metric",
    });

    // Add waypoints if any
    if (waypoints.length > 0) {
      const waypointsStr = waypoints
        .map((wp) => `${wp.lat},${wp.lng}`)
        .join("|");
      params.append("waypoints", waypointsStr);
    }

    const url = `${baseUrl}?${params.toString()}`;

    // Use cache wrapper for the API call
    const data = await withDirectionsCache(places, "driving", async () => {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    });

    try {
      const duration = Date.now() - startTime;

      if (data.status === "ZERO_RESULTS") {
        console.warn(
          `⚠️ DirectionsService: No driving route found, creating fallback straight-line response`
        );

        // Log zero results
        apiLogger.logGoogleDirectionsCall({
          origin: origin.name,
          destination: destination.name,
          waypoints: waypoints.map((wp) => wp.name),
          mode: "driving",
          routeFound: false,
          duration,
          status: "success",
        });

        return FallbackDirectionsService.createFallbackStraightLineResponse(
          places
        );
      }

      if (data.status !== "OK") {
        const error = new Error(
          `Directions API error: ${data.status} - ${
            data.error_message || "Unknown error"
          }`
        );

        // Log API error
        apiLogger.logGoogleDirectionsCall({
          origin: origin.name,
          destination: destination.name,
          waypoints: waypoints.map((wp) => wp.name),
          mode: "driving",
          routeFound: false,
          duration,
          status: "error",
          error: error.message,
        });

        throw error;
      }

      // Extract route information for logging
      const route = data.routes?.[0];
      const totalDistance = route?.legs?.reduce(
        (sum: number, leg: any) => sum + (leg.distance?.value || 0),
        0
      );
      const totalDuration = route?.legs?.reduce(
        (sum: number, leg: any) => sum + (leg.duration?.value || 0),
        0
      );

      // Log successful call
      apiLogger.logGoogleDirectionsCall({
        origin: origin.name,
        destination: destination.name,
        waypoints: waypoints.map((wp) => wp.name),
        mode: "driving",
        routeFound: true,
        totalDistance: totalDistance
          ? `${(totalDistance / 1000).toFixed(1)} km`
          : undefined,
        totalDuration: totalDuration
          ? `${Math.round(totalDuration / 60)} mins`
          : undefined,
        duration,
        status: "success",
      });

      return data;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log failed call
      apiLogger.logGoogleDirectionsCall({
        origin: origin.name,
        destination: destination.name,
        waypoints: waypoints.map((wp) => wp.name),
        mode: "driving",
        routeFound: false,
        duration,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });

      console.error(
        "❌ DirectionsService: Error calculating directions:",
        error
      );
      throw error;
    }
  }

  /**
   * Extract driving times between consecutive places
   * @param directionsResponse Response from Google Directions API
   * @param places Original places array
   * @returns Array of driving times in minutes (first place gets 0)
   */
  extractDrivingTimes(
    directionsResponse: DirectionsResponse,
    places: PlaceCoordinate[]
  ): number[] {
    if (directionsResponse.routes.length === 0) {
      console.warn("⚠️ DirectionsService: No routes found in response");
      return places.map(() => 0);
    }

    const route = directionsResponse.routes[0];
    const legs = route.legs;

    // First place has no driving time from previous
    const drivingTimes = [0];

    // Add driving time for each subsequent place
    legs.forEach((leg) => {
      const drivingTimeMinutes = Math.round(leg.duration.value / 60);
      drivingTimes.push(drivingTimeMinutes);
    });

    return drivingTimes;
  }

  /**
   * Extract driving distances between consecutive places
   * @param directionsResponse Response from Google Directions API
   * @param places Original places array
   * @returns Array of driving distances in meters (first place gets 0)
   */
  extractDrivingDistances(
    directionsResponse: DirectionsResponse,
    places: PlaceCoordinate[]
  ): number[] {
    if (directionsResponse.routes.length === 0) {
      return places.map(() => 0);
    }

    const route = directionsResponse.routes[0];
    const legs = route.legs;

    // First place has no driving distance from previous
    const distances = [0];

    // Add driving distance for each subsequent place
    legs.forEach((leg) => {
      distances.push(leg.distance.value);
    });

    return distances;
  }
}
