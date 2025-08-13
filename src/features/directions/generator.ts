"use server";

import { DirectionsData } from "./types";
import { GeneratedItinerary } from "@/services/openai/itinerary";
import {
  PlaceCoordinate,
  DirectionsResponse,
} from "@/services/google/directions";
import {
  calculateDirections,
  extractDrivingTimes,
} from "@/features/editor/actions/directions";
import { getDayColor } from "@/features/map/utils/colors";

/**
 * Extract places from GeneratedItinerary grouped by day
 */
export async function extractPlacesFromItinerary(itinerary: GeneratedItinerary): Promise<{
  [dayIndex: number]: PlaceCoordinate[];
}> {
  const placesByDay: { [dayIndex: number]: PlaceCoordinate[] } = {};

  itinerary.days.forEach((day) => {
    const places: PlaceCoordinate[] = [];

    day.places.forEach((place, placeIndex) => {
      // Only include places with valid coordinates
      if (place.lat && place.lng && place.name) {
        const uid = `place_${day.dayNumber}_${placeIndex}`;
        places.push({
          lat: place.lat,
          lng: place.lng,
          uid: uid,
          name: place.name,
        });
      }
    });

    if (places.length > 0) {
      // Use 0-based dayIndex (dayNumber - 1) for consistency with editor extraction
      const dayIndex = day.dayNumber - 1;
      placesByDay[dayIndex] = places;
    }
  });

  console.log(
    `📊 Extracted places across ${
      Object.keys(placesByDay).length
    } days from itinerary`
  );

  return placesByDay;
}

/**
 * Calculate directions for multiple days
 */
export async function calculateDirectionsForDays(placesByDay: {
  [dayIndex: number]: PlaceCoordinate[];
}): Promise<{
  directions: DirectionsData[];
  drivingTimesByUid: { [uid: string]: { time: number; distance: number } };
}> {
  const directionsResults: DirectionsData[] = [];
  const drivingTimesByUid: {
    [uid: string]: { time: number; distance: number };
  } = {};

  // Calculate directions for each day with at least 2 places
  for (const [dayIndexStr, places] of Object.entries(placesByDay)) {
    const dayIndex = parseInt(dayIndexStr); // This is actually 0-based dayIndex, not 1-based dayNumber
    const dayNumber = dayIndex + 1; // Convert to 1-based for display

    if (places.length < 2) {
      console.log(
        `🚗 Day ${dayNumber}: Only ${
          places.length
        } place(s), skipping directions`
      );
      continue;
    }

    console.log(
      `🚗 Day ${dayNumber}: Calculating directions for ${
        places.length
      } places`
    );

    try {
      // Call directions API for this day
      const directionsResponse: DirectionsResponse = await calculateDirections(
        places
      );

      // Check if this is a fallback straight-line response
      if (directionsResponse.isFallbackStraightLine) {
        console.warn(
          `⚠️ Day ${dayNumber}: No driving route found, using straight-line fallback`
        );
      }

      // Extract driving times and distances
      const { times, distances } = await extractDrivingTimes(
        directionsResponse,
        places
      );

      // Store driving times by UID
      places.forEach((place, index) => {
        if (place.uid) {
          drivingTimesByUid[place.uid] = {
            time: times[index] || 0,
            distance: distances[index] || 0,
          };
        }
      });

      // Store directions result for map rendering
      // dayIndex is already 0-based, no conversion needed
      
      // Validate dayIndex is valid (non-negative)
      if (dayIndex < 0) {
        console.warn(`⚠️ Skipping directions for invalid dayIndex: ${dayIndex}`);
        continue;
      }
      
      const dayColor = getDayColor(dayIndex);
      
      // Validate color is valid
      if (!dayColor) {
        console.warn(`⚠️ Skipping directions for dayIndex ${dayIndex} - no color available`);
        continue;
      }
      
      directionsResults.push({
        dayIndex,
        color: dayColor,
        directionsResult: directionsResponse,
      });

      const routeType = directionsResponse.isFallbackStraightLine
        ? "straight-line fallback"
        : "driving route";
      console.log(
        `✅ Day ${dayNumber}: ${routeType} calculated successfully`
      );
    } catch (error) {
      console.error(
        `❌ Day ${dayNumber}: Error calculating directions:`,
        error
      );
    }
  }

  const fallbackCount = directionsResults.filter(
    (r) => r.directionsResult.isFallbackStraightLine
  ).length;
  const realRoutesCount = directionsResults.length - fallbackCount;

  console.log(
    `✅ Directions calculation completed - ${realRoutesCount} driving routes, ${fallbackCount} straight-line fallbacks`
  );

  return {
    directions: directionsResults,
    drivingTimesByUid,
  };
}

/**
 * Generate directions from a GeneratedItinerary - main endpoint
 */
export async function generateDirectionsFromItinerary(
  itinerary: GeneratedItinerary
): Promise<DirectionsData[]> {
  console.log("🚗 Starting directions generation from itinerary");

  try {
    // Extract places from itinerary
    const placesByDay = await extractPlacesFromItinerary(itinerary);

    if (Object.keys(placesByDay).length === 0) {
      console.log("🚗 No days with places found in itinerary");
      return [];
    }

    // Calculate directions for all days
    const { directions } = await calculateDirectionsForDays(placesByDay);

    console.log(
      `🚗 Generated ${directions.length} direction routes for itinerary`
    );
    return directions;
  } catch (error) {
    console.error("❌ Error generating directions from itinerary:", error);
    // Return empty array rather than throwing - directions are optional
    return [];
  }
}

/**
 * Generate directions and update itinerary with driving times
 */
export async function generateDirectionsWithTimes(
  itinerary: GeneratedItinerary
): Promise<{
  directions: DirectionsData[];
  updatedItinerary: GeneratedItinerary;
}> {
  console.log("🚗 Starting directions generation with driving times update");

  try {
    // Extract places from itinerary
    const placesByDay = await extractPlacesFromItinerary(itinerary);

    if (Object.keys(placesByDay).length === 0) {
      console.log("🚗 No days with places found in itinerary");
      return {
        directions: [],
        updatedItinerary: itinerary,
      };
    }

    // Calculate directions for all days
    const { directions, drivingTimesByUid } = await calculateDirectionsForDays(placesByDay);

    // Update the itinerary with driving times
    const updatedItinerary: GeneratedItinerary = {
      ...itinerary,
      days: itinerary.days.map((day) => ({
        ...day,
        places: day.places.map((place, placeIndex) => {
          const uid = `place_${day.dayNumber}_${placeIndex}`;
          const drivingData = drivingTimesByUid[uid];
          
          if (drivingData) {
            return {
              ...place,
              drivingTimeFromPrevious: drivingData.time,
              drivingDistanceFromPrevious: drivingData.distance,
            };
          }
          
          return place;
        }),
      })),
    };

    console.log(
      `🚗 Generated ${directions.length} direction routes and updated itinerary with driving times`
    );

    return {
      directions,
      updatedItinerary,
    };
  } catch (error) {
    console.error("❌ Error generating directions with times:", error);
    // Return original itinerary and empty directions rather than throwing
    return {
      directions: [],
      updatedItinerary: itinerary,
    };
  }
}
