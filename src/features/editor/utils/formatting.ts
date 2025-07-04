/**
 * Format driving time (minutes) and distance (meters) to "HH:MM / 67km" format
 * @param timeInMinutes - Driving time in minutes
 * @param distanceInMeters - Distance in meters
 * @returns Formatted string like "1:23 / 67km"
 */
export function formatDrivingTimeAndDistance(
  timeInMinutes: number,
  distanceInMeters: number
): string {
  // Convert minutes to HH:MM format
  const hours = Math.floor(timeInMinutes / 60);
  const minutes = timeInMinutes % 60;
  const timeStr = `${hours}:${minutes.toString().padStart(2, "0")}`;

  // Convert meters to kilometers (no decimals for >= 1km)
  const distanceInKm = distanceInMeters / 1000;
  const distanceStr =
    distanceInKm >= 1
      ? `${Math.round(distanceInKm)}km`
      : `${distanceInMeters}m`;

  return `${timeStr} / ${distanceStr}`;
}

/**
 * Format time in minutes to HH:MM format
 * @param timeInMinutes - Time in minutes
 * @returns Formatted time string like "1:23" or "0:34" for under 1 hour
 */
export function formatTime(timeInMinutes: number): string {
  const hours = Math.floor(timeInMinutes / 60);
  const minutes = timeInMinutes % 60;

  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

/**
 * Format distance in meters to appropriate unit
 * @param distanceInMeters - Distance in meters
 * @returns Formatted distance string like "67km" or "250m"
 */
export function formatDistance(distanceInMeters: number): string {
  const distanceInKm = distanceInMeters / 1000;

  if (distanceInKm >= 1) {
    return `${Math.round(distanceInKm)}km`;
  } else {
    return `${distanceInMeters}m`;
  }
}
