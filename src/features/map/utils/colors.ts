import { DAY_COLORS, DayColor } from "../types";

/**
 * Get color for a specific day index
 */
export function getDayColor(dayIndex: number): DayColor {
  return DAY_COLORS[dayIndex % DAY_COLORS.length];
}

/**
 * Get all day colors with their indices
 */
export function getAllDayColors(): Array<{ index: number; color: DayColor }> {
  return DAY_COLORS.map((color, index) => ({ index, color }));
}

/**
 * Convert hex color to RGB for Google Maps marker
 */
export function hexToRgb(
  hex: string
): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Create SVG marker icon with specified color
 */
export function createMarkerIcon(color: string, size: number = 32): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}" stroke="white" stroke-width="1"/>
      <circle cx="12" cy="9" r="2.5" fill="white"/>
    </svg>
  `)}`;
}

/**
 * Get default color for places not assigned to any day
 */
export function getDefaultPlaceColor(): string {
  return "#6B7280"; // Gray color for unassigned places
}

/**
 * Create SVG marker icon with specified color and number/letter
 */
export function createNumberedMarkerIcon(
  color: string,
  number: number | string,
  size: number = 32
): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}" stroke="white" stroke-width="1"/>
      <circle cx="12" cy="9" r="6" fill="${color}" stroke="white" stroke-width="1"/>
      <text x="12" y="13" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="8" font-weight="bold">${number}</text>
    </svg>
  `)}`;
}

/**
 * Get place-specific colors (different from day colors)
 */
export const PLACE_COLORS = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#96CEB4", // Green
  "#FFEAA7", // Yellow
  "#DDA0DD", // Plum
  "#FFB347", // Orange
  "#87CEEB", // Sky Blue
  "#F0E68C", // Khaki
  "#FFB6C1", // Light Pink
  "#20B2AA", // Light Sea Green
  "#FFA07A", // Light Salmon
  "#B19CD9", // Light Purple
  "#FF7F50", // Coral
  "#32CD32", // Lime Green
] as const;

/**
 * Get color for a specific place index within a day
 */
export function getPlaceColor(placeIndexInDay: number): string {
  return PLACE_COLORS[placeIndexInDay % PLACE_COLORS.length];
}
