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