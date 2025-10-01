"use server";

import {
  GoogleDirectionsService,
  PlaceCoordinate,
  DirectionsResponse,
} from "@/services/google/directions";

// Get API key from environment
const getApiKey = () => {
  const apiKey = process.env.GOOGLE_DIRECTIONS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY environment variable is not set");
  }
  return apiKey;
};

/**
 * Calculate directions between places with specified transport mode
 */
export async function calculateDirections(
  places: PlaceCoordinate[],
  mode: string = "driving"
): Promise<DirectionsResponse> {
  try {
    console.log(
      `🚗 Server Action: Calculating ${mode} directions for ${places.length} places`
    );

    const apiKey = getApiKey();
    const directionsService = new GoogleDirectionsService(apiKey);

    const response = await directionsService.calculateDirections(places, mode);

    console.log(`✅ Server Action: ${mode} directions calculated successfully`);
    return response;
  } catch (error) {
    console.error(`❌ Server Action: Error calculating ${mode} directions:`, error);
    throw error;
  }
}

/**
 * Extract travel times from directions response
 */
export async function extractDrivingTimes(
  directionsResponse: DirectionsResponse,
  places: PlaceCoordinate[]
): Promise<{
  times: number[]; // minutes
  distances: number[]; // meters
}> {
  try {
    const apiKey = getApiKey();
    const directionsService = new GoogleDirectionsService(apiKey);

    const times = directionsService.extractDrivingTimes(
      directionsResponse,
      places
    );
    const distances = directionsService.extractDrivingDistances(
      directionsResponse,
      places
    );

    return { times, distances };
  } catch (error) {
    console.error("❌ Server Action: Error extracting travel data:", error);
    throw error;
  }
}

