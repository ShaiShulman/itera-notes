import { IconPaths } from "@/assets/icons/iconLoader";

/**
 * Get transport icon path for a given mode
 */
export function getTransportIconPath(mode: string = "driving"): string {
  switch (mode.toLowerCase()) {
    case "transit":
      return IconPaths.TRANSIT;
    case "walking":
      return IconPaths.WALKING;
    case "driving":
    default:
      return IconPaths.DRIVING;
  }
}
