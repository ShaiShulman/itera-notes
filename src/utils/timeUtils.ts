/**
 * Format time relative to now with smart date display
 * Shows relative time (e.g. "2d ago") for recent dates
 * Shows full date for dates older than 7 days
 */
export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 10) {
    return "just now";
  } else if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);

    // Show relative time for up to 7 days, then show date
    if (days <= 7) {
      return `${days}d ago`;
    } else {
      // Show date for older items
      return date.toLocaleDateString();
    }
  }
}

/**
 * Format relative time with real-time updates
 * Similar to formatTimeAgo but designed for components that update frequently
 */
export function formatRelativeTime(date: Date): string {
  return formatTimeAgo(date);
}

/**
 * Format date nicely as "Thu, Sep 4"
 * @param dateString - The date string to format
 * @returns The formatted date
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

/**
 * Calculate a neutral time for transit directions (next Tuesday at 12:00 PM local time)
 * This ensures consistent transit results regardless of when the API is called
 * @returns Unix timestamp in seconds since January 1, 1970 UTC
 */
export function getNeutralTransitTime(): number {
  const now = new Date();

  // Find the next Tuesday
  const nextTuesday = new Date(now);
  const daysUntilTuesday = (2 - now.getDay() + 7) % 7; // Tuesday is day 2 (0=Sunday, 1=Monday, 2=Tuesday...)

  // If today is Tuesday and it's before noon, use today. Otherwise, find next Tuesday
  if (daysUntilTuesday === 0 && now.getHours() < 12) {
    // Keep current date (today is Tuesday and before noon)
  } else {
    // Add days to get to next Tuesday (or today + 7 if already past Tuesday noon)
    nextTuesday.setDate(now.getDate() + (daysUntilTuesday === 0 ? 7 : daysUntilTuesday));
  }

  // Set time to 12:00 PM (noon) local time
  nextTuesday.setHours(12, 0, 0, 0);

  // Return as Unix timestamp in seconds (Google API expects seconds, not milliseconds)
  return Math.floor(nextTuesday.getTime() / 1000);
}
