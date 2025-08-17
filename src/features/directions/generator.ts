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
import { PlaceBlockData, HotelBlockData } from "@/features/editor/types";

/**
 * Find the ending location for a given day based on business rules:
 * 1. If any place/hotel has isDayFinish: true, use that location
 * 2. Otherwise, use the last place (excluding hotels) from that day
 */
function findDayEndingLocation(
  places: PlaceCoordinate[],
  allPlacesData: (PlaceBlockData | HotelBlockData)[]
): PlaceCoordinate | null {
  if (places.length === 0) return null;

  // Find places data that correspond to the current day's places
  const dayPlacesData = allPlacesData.filter(placeData => 
    places.some(place => place.uid === placeData.uid)
  );

  // Rule 1: Look for a place/hotel with isDayFinish: true
  const dayFinishPlace = dayPlacesData.find(placeData => placeData.isDayFinish === true);
  if (dayFinishPlace) {
    const dayFinishCoordinate = places.find(place => place.uid === dayFinishPlace.uid);
    if (dayFinishCoordinate) {
      console.log(`🏁 Day ending location: ${dayFinishCoordinate.name} (marked as day finish)`);
      return dayFinishCoordinate;
    }
  }

  // Rule 2: Use the last place (excluding hotels) from that day
  // Filter to only places (not hotels) by checking the __type property
  const onlyPlaces = dayPlacesData.filter(placeData => 
    (placeData as any).__type !== "hotel"
  );
  
  if (onlyPlaces.length > 0) {
    // Get the last place from the filtered list
    const lastPlace = onlyPlaces[onlyPlaces.length - 1];
    const lastPlaceCoordinate = places.find(place => place.uid === lastPlace.uid);
    if (lastPlaceCoordinate) {
      console.log(`🏁 Day ending location: ${lastPlaceCoordinate.name} (last place)`);
      return lastPlaceCoordinate;
    }
  }

  // Fallback: if no places found, use the last coordinate regardless of type
  const lastCoordinate = places[places.length - 1];
  console.log(`🏁 Day ending location: ${lastCoordinate.name} (fallback - last coordinate)`);
  return lastCoordinate;
}

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
 * Convert GeneratedItinerary places to PlaceBlockData format for cross-day direction calculations
 */
function convertPlaceLocationsToPlaceData(itinerary: GeneratedItinerary): PlaceBlockData[] {
  return itinerary.days.flatMap((day) => 
    day.places.map((place, index) => ({
      uid: `place_${day.dayNumber}_${index}`,
      name: place.name || "",
      shortName: place.shortName || "",
      linkedParagraphId: place.linkedParagraphId || "",
      lat: place.lat || 0,
      lng: place.lng || 0,
      placeId: place.placeId || "",
      address: place.address || "",
      rating: place.rating || 0,
      photoReferences: place.photoReferences || [],
      description: place.description || "",
      thumbnailUrl: place.thumbnailUrl || "",
      status: place.status || "found",
      notes: "",
      drivingTimeFromPrevious: place.drivingTimeFromPrevious || 0,
      drivingDistanceFromPrevious: place.drivingDistanceFromPrevious || 0,
      isDayFinish: false, // Default for new itineraries
      hideInMap: false,
      __type: "place" as const,
    }))
  );
}

/**
 * Calculate directions for multiple days with cross-day connections
 * This version is specifically for editor context where we have place metadata
 */
export async function calculateDirectionsForDaysWithCrossDayConnections(
  placesByDay: { [dayIndex: number]: PlaceCoordinate[] },
  allPlacesData: (PlaceBlockData | HotelBlockData)[]
): Promise<{
  directions: DirectionsData[];
  drivingTimesByUid: { [uid: string]: { time: number; distance: number } };
}> {
  const directionsResults: DirectionsData[] = [];
  const drivingTimesByUid: {
    [uid: string]: { time: number; distance: number };
  } = {};

  const dayIndices = Object.keys(placesByDay).map(k => parseInt(k)).sort((a, b) => a - b);
  
  for (let i = 0; i < dayIndices.length; i++) {
    const dayIndex = dayIndices[i];
    const dayNumber = dayIndex + 1;
    let places = placesByDay[dayIndex];

    if (places.length === 0) {
      console.log(`🚗 Day ${dayNumber}: No places, skipping directions`);
      continue;
    }

    // For days after the first, prepend the ending location from previous day
    if (i > 0) {
      const previousDayIndex = dayIndices[i - 1];
      const previousDayPlaces = placesByDay[previousDayIndex];
      
      if (previousDayPlaces.length > 0) {
        const previousDayEndingLocation = findDayEndingLocation(previousDayPlaces, allPlacesData);
        
        if (previousDayEndingLocation) {
          // Create a cross-day connection by prepending the previous day's ending location
          places = [previousDayEndingLocation, ...places];
          console.log(`🔗 Day ${dayNumber}: Added cross-day connection from ${previousDayEndingLocation.name}`);
        }
      }
    }

    if (places.length < 2) {
      console.log(
        `🚗 Day ${dayNumber}: Only ${places.length} place(s) after cross-day logic, skipping directions`
      );
      continue;
    }

    console.log(
      `🚗 Day ${dayNumber}: Calculating directions for ${places.length} places (${i > 0 ? 'including cross-day connection' : 'first day'})`
    );

    try {
      // Call directions API for this day
      const directionsResponse: DirectionsResponse = await calculateDirections(places);

      // Check if this is a fallback straight-line response
      if (directionsResponse.isFallbackStraightLine) {
        console.warn(
          `⚠️ Day ${dayNumber}: No driving route found, using straight-line fallback`
        );
      }

      // Extract driving times and distances
      const { times, distances } = await extractDrivingTimes(directionsResponse, places);

      // Store driving times by UID (skip the first place for days after the first, as it's from previous day)
      const startIndex = i > 0 ? 1 : 0; // Skip cross-day connection point
      places.slice(startIndex).forEach((place, index) => {
        if (place.uid) {
          const actualIndex = index + startIndex;
          drivingTimesByUid[place.uid] = {
            time: times[actualIndex] || 0,
            distance: distances[actualIndex] || 0,
          };
        }
      });

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
        `✅ Day ${dayNumber}: ${routeType} calculated successfully with cross-day logic`
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
    `✅ Cross-day directions calculation completed - ${realRoutesCount} driving routes, ${fallbackCount} straight-line fallbacks`
  );

  return {
    directions: directionsResults,
    drivingTimesByUid,
  };
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

    // Convert to place data for cross-day logic
    const allPlacesData = convertPlaceLocationsToPlaceData(itinerary);

    // Calculate directions using cross-day connections
    const { directions, drivingTimesByUid } = await calculateDirectionsForDaysWithCrossDayConnections(placesByDay, allPlacesData);

    // Update the itinerary with driving times
    const updatedItinerary: GeneratedItinerary = {
      ...itinerary,
      days: itinerary.days.map((day) => ({
        ...day,
        places: day.places.map((place, placeIndex) => {
          const uid = `place_${day.dayNumber}_${placeIndex}`;
          const drivingData = drivingTimesByUid[uid];
          
          return drivingData ? {
            ...place,
            drivingTimeFromPrevious: drivingData.time,
            drivingDistanceFromPrevious: drivingData.distance,
          } : place;
        }),
      })),
    };

    console.log(
      `🚗 Generated ${directions.length} direction routes and updated itinerary with driving times using cross-day connections`
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
