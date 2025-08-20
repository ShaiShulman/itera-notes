import { BasePlaceBlockData } from "../types";

/**
 * Extract day number from place UID pattern (e.g., "place_1_abc123" -> 1)
 */
export function extractDayNumberFromPlace(place: BasePlaceBlockData): number | undefined {
  if (place.uid && place.uid.includes('_')) {
    const parts = place.uid.split('_');
    if (parts.length >= 2 && !isNaN(Number(parts[1]))) {
      return Number(parts[1]);
    }
  }
  return undefined;
}

/**
 * Extract sequence number from place UID pattern (e.g., "place_1_abc123" -> "abc123")
 */
export function extractSequenceFromPlace(place: BasePlaceBlockData): string {
  if (place.uid && place.uid.includes('_')) {
    const parts = place.uid.split('_');
    if (parts.length >= 3) {
      return parts[2];
    }
  }
  return '0';
}

/**
 * Sort places by their sequence within a day
 */
export function sortPlacesBySequence(places: BasePlaceBlockData[]): BasePlaceBlockData[] {
  return places.sort((a, b) => {
    const aSequence = extractSequenceFromPlace(a);
    const bSequence = extractSequenceFromPlace(b);
    return aSequence.localeCompare(bSequence);
  });
}

/**
 * Check if a place is likely a hotel based on name and address
 * This is a simplified check for filtering out hotels when finding day ending locations
 */
export function isLikelyHotel(place: BasePlaceBlockData): boolean {
  const nameCheck = place.name?.toLowerCase().includes('hotel') || 
                   place.name?.toLowerCase().includes('hostel') ||
                   place.name?.toLowerCase().includes('inn') ||
                   place.name?.toLowerCase().includes('resort');
  
  const addressCheck = place.address?.toLowerCase().includes('hotel') ||
                      place.address?.toLowerCase().includes('hostel');
  
  return !!(nameCheck || addressCheck);
}

/**
 * Find the ending location for a specific day based on business rules from directions generator:
 * 1. If any place has isDayFinish: true, use that location
 * 2. Otherwise, use the last place (excluding hotels) from that day
 * 3. Fallback: use the last place regardless of type
 */
export function findDayEndingPlace(
  dayNumber: number, 
  allPlaces: BasePlaceBlockData[]
): BasePlaceBlockData | undefined {
  // Get all places from the specified day, excluding hidden ones
  const dayPlaces = allPlaces
    .filter(place => {
      const placeDayNumber = extractDayNumberFromPlace(place);
      return placeDayNumber === dayNumber && !place.hideInMap;
    });
  
  if (dayPlaces.length === 0) return undefined;
  
  // Sort places by their sequence in the day
  const sortedDayPlaces = sortPlacesBySequence(dayPlaces);
  
  // Rule 1: Look for a place with isDayFinish: true
  const dayFinishPlace = sortedDayPlaces.find(place => place.isDayFinish === true);
  if (dayFinishPlace) {
    return dayFinishPlace;
  }
  
  // Rule 2: Use the last place (excluding hotels) from that day
  const onlyPlaces = sortedDayPlaces.filter(place => !isLikelyHotel(place));
  
  if (onlyPlaces.length > 0) {
    return onlyPlaces[onlyPlaces.length - 1];
  }
  
  // Fallback: use the last place regardless of type
  return sortedDayPlaces[sortedDayPlaces.length - 1];
}

/**
 * Find the previous location (place name) for a given place in the itinerary.
 * This follows the same logic as the directions generator for cross-day connections:
 * - For places within a day: returns the previous place in the same day
 * - For first place of a day: returns the ending location from the previous day
 */
export function getPreviousLocationForPlace(
  currentPlace: BasePlaceBlockData,
  allPlaces: BasePlaceBlockData[]
): string | undefined {
  if (!currentPlace.uid) return undefined;
  
  const currentDayNumber = extractDayNumberFromPlace(currentPlace);
  if (!currentDayNumber) return undefined;
  
  // Get all places from the same day, sorted by their order
  const dayPlaces = allPlaces
    .filter(place => extractDayNumberFromPlace(place) === currentDayNumber)
    .filter(place => !place.hideInMap); // Exclude hidden places
  
  const sortedDayPlaces = sortPlacesBySequence(dayPlaces);
  
  // Find current place index 
  const currentIndex = sortedDayPlaces.findIndex(place => place.uid === currentPlace.uid);
  
  // If this is the first place of the day and it's not day 1, check for previous day's ending location
  if (currentIndex === 0 && currentDayNumber > 1) {
    const previousDayEndingPlace = findDayEndingPlace(currentDayNumber - 1, allPlaces);
    return previousDayEndingPlace?.name;
  }
  
  // Otherwise, get previous place from same day
  if (currentIndex > 0) {
    return sortedDayPlaces[currentIndex - 1].name;
  }
  
  return undefined;
}

/**
 * Get all places for a specific day, sorted by sequence
 */
export function getPlacesForDay(
  dayNumber: number, 
  allPlaces: BasePlaceBlockData[],
  includeHidden: boolean = false
): BasePlaceBlockData[] {
  const dayPlaces = allPlaces.filter(place => {
    const placeDayNumber = extractDayNumberFromPlace(place);
    return placeDayNumber === dayNumber && (includeHidden || !place.hideInMap);
  });
  
  return sortPlacesBySequence(dayPlaces);
}

/**
 * Check if a place is the first place of its day
 */
export function isFirstPlaceOfDay(
  place: BasePlaceBlockData,
  allPlaces: BasePlaceBlockData[]
): boolean {
  const dayNumber = extractDayNumberFromPlace(place);
  if (!dayNumber) return false;
  
  const dayPlaces = getPlacesForDay(dayNumber, allPlaces);
  return dayPlaces.length > 0 && dayPlaces[0].uid === place.uid;
}

/**
 * Check if a place is the last place of its day
 */
export function isLastPlaceOfDay(
  place: BasePlaceBlockData,
  allPlaces: BasePlaceBlockData[]
): boolean {
  const dayNumber = extractDayNumberFromPlace(place);
  if (!dayNumber) return false;
  
  const dayPlaces = getPlacesForDay(dayNumber, allPlaces);
  return dayPlaces.length > 0 && dayPlaces[dayPlaces.length - 1].uid === place.uid;
}