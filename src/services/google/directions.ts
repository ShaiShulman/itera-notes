// Google Directions API service
import { FallbackDirectionsService } from "./fallbackDirections";
import { withDirectionsCache } from "./cacheWrappers";
import { getNeutralTransitTime } from "@/utils/timeUtils";
import { apiLogger } from "@/services/logging/apiLogger";
import {
  DirectionsStep,
  DirectionsLeg,
  DirectionsRoute,
  DirectionsResponse,
  PlaceCoordinate,
} from "./directionsTypes";

// Re-export types for external use
export type {
  DirectionsStep,
  DirectionsLeg,
  DirectionsRoute,
  DirectionsResponse,
  PlaceCoordinate,
};

export class GoogleDirectionsService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Calculate directions between multiple places in order
   * @param places Array of places with coordinates
   * @param mode Transport mode ('driving', 'transit', 'walking')
   * @returns Promise with directions data (real or fallback straight-line)
   */
  async calculateDirections(
    places: PlaceCoordinate[],
    mode: string = "driving"
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
      mode: mode,
      units: "metric",
    });

    // Add departure_time for transit mode to ensure neutral time calculations
    if (mode === "transit") {
      const neutralTime = getNeutralTransitTime();
      params.append("departure_time", neutralTime.toString());
      console.log(`🚌 Using neutral transit time: ${new Date(neutralTime * 1000).toLocaleString()}`);
    }

    // Add waypoints if any (but not for transit mode - Google requires exactly 2 points)
    if (waypoints.length > 0 && mode !== "transit") {
      const waypointsStr = waypoints
        .map((wp) => `${wp.lat},${wp.lng}`)
        .join("|");
      params.append("waypoints", waypointsStr);
    }

    const url = `${baseUrl}?${params.toString()}`;

    // Use cache wrapper for the API call
    const { result: data, fromCache } = await withDirectionsCache(places, mode, async () => {
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
          `⚠️ DirectionsService: No ${mode} route found, creating fallback straight-line response`
        );

        // Log zero results
        apiLogger.logGoogleDirectionsCall({
          origin: origin.name,
          destination: destination.name,
          waypoints: waypoints.map((wp) => wp.name),
          mode: mode,
          routeFound: false,
          duration,
          status: "success",
          fromCache,
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
          mode: mode,
          routeFound: false,
          duration,
          status: "error",
          fromCache,
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
        mode: mode,
        routeFound: true,
        totalDistance: totalDistance
          ? `${(totalDistance / 1000).toFixed(1)} km`
          : undefined,
        totalDuration: totalDuration
          ? `${Math.round(totalDuration / 60)} mins`
          : undefined,
        duration,
        status: "success",
        fromCache,
      });

      return data;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log failed call
      apiLogger.logGoogleDirectionsCall({
        origin: origin.name,
        destination: destination.name,
        waypoints: waypoints.map((wp) => wp.name),
        mode: mode,
        routeFound: false,
        duration,
        status: "error",
        fromCache: false,
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
   * Extract travel times between consecutive places
   * @param directionsResponse Response from Google Directions API
   * @param places Original places array
   * @returns Array of travel times in minutes (first place gets 0)
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

    // Add travel time for each subsequent place
    legs.forEach((leg) => {
      const travelTimeMinutes = Math.round(leg.duration.value / 60);
      drivingTimes.push(travelTimeMinutes);
    });

    return drivingTimes;
  }

  /**
   * Extract travel distances between consecutive places
   * @param directionsResponse Response from Google Directions API
   * @param places Original places array
   * @returns Array of travel distances in meters (first place gets 0)
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

    // First place has no travel distance from previous
    const distances = [0];

    // Add travel distance for each subsequent place
    legs.forEach((leg) => {
      distances.push(leg.distance.value);
    });

    return distances;
  }

}
