// Fallback straight-line directions service
import {
  DirectionsResponse,
  DirectionsLeg,
  PlaceCoordinate,
} from "./directions";
import { calculateStraightLineDistance } from "@/utils/distance";

/**
 * Service for creating fallback straight-line directions when real driving routes are unavailable
 */
export class FallbackDirectionsService {

  /**
   * Create a fallback DirectionsResponse with straight-line connections
   * @param places Array of places to connect with straight lines
   * @returns DirectionsResponse with straight-line data
   */
  static createFallbackStraightLineResponse(
    places: PlaceCoordinate[]
  ): DirectionsResponse {
    console.log(
      `🔄 FallbackDirectionsService: Creating straight-line response for ${places.length} places`
    );

    const legs: DirectionsLeg[] = [];

    // Create legs for consecutive place pairs
    for (let i = 0; i < places.length - 1; i++) {
      const start = places[i];
      const end = places[i + 1];

      const distance = calculateStraightLineDistance(
        start.lat,
        start.lng,
        end.lat,
        end.lng
      );

      const leg: DirectionsLeg = {
        distance: {
          text: `${(distance / 1000).toFixed(1)} km`,
          value: Math.round(distance),
        },
        duration: {
          text: "0 min", // No travel time for straight-line connections
          value: 0, // No travel time for straight-line connections
        },
        start_location: {
          lat: start.lat,
          lng: start.lng,
        },
        end_location: {
          lat: end.lat,
          lng: end.lng,
        },
      };

      legs.push(leg);
    }

    // Create a simple encoded polyline for straight lines (stored as coordinates)
    const polylinePoints = places
      .map((place) => `${place.lat},${place.lng}`)
      .join("|");

    const fallbackResponse: DirectionsResponse = {
      routes: [
        {
          legs,
          overview_polyline: {
            points: polylinePoints, // Store coordinates directly for straight-line rendering
          },
        },
      ],
      status: "OK",
      isFallbackStraightLine: true,
      request: {
        origin: { lat: places[0].lat, lng: places[0].lng },
        destination: {
          lat: places[places.length - 1].lat,
          lng: places[places.length - 1].lng,
        },
        waypoints: places.slice(1, -1).map((place) => ({
          location: { lat: place.lat, lng: place.lng },
        })),
        travelMode: "driving",
        unitSystem: "metric",
      },
    };

    console.log(
      `✅ FallbackDirectionsService: Created response with ${legs.length} straight-line legs (no travel times)`
    );
    return fallbackResponse;
  }

  /**
   * Check if a DirectionsResponse is a fallback straight-line response
   * @param response DirectionsResponse to check
   * @returns True if this is a fallback response
   */
  static isFallbackResponse(response: DirectionsResponse): boolean {
    return response.isFallbackStraightLine === true;
  }

  /**
   * Get a human-readable description of the fallback route
   * @param places Array of places
   * @returns Description string
   */
  static getFallbackDescription(places: PlaceCoordinate[]): string {
    if (places.length < 2) return "No route";
    if (places.length === 2) {
      return `Straight-line connection: ${places[0].name} → ${places[1].name}`;
    }
    return `Straight-line route: ${places[0].name} → ... → ${
      places[places.length - 1].name
    } (${places.length} stops)`;
  }
}
