/**
 * Centralized transport types and constants
 * Used across create-itinerary, generateLLM, directions, and editor components
 */

// Base transport modes (actual modes supported by Google Directions API)
export const TRANSPORT_MODES = {
  DRIVING: "driving",
  TRANSIT: "transit",
  WALKING: "walking",
} as const;

export type TransportMode = typeof TRANSPORT_MODES[keyof typeof TRANSPORT_MODES];

// Transport preferences (includes auto-determination for form selection)
export const TRANSPORT_PREFERENCES = {
  AUTO: "auto",
  ...TRANSPORT_MODES,
} as const;

export type TransportPreference = typeof TRANSPORT_PREFERENCES[keyof typeof TRANSPORT_PREFERENCES];

// Transport mode options for UI components
export const TRANSPORT_MODE_OPTIONS: ReadonlyArray<{
  value: TransportMode;
  label: string;
  description: string;
}> = [
  {
    value: TRANSPORT_MODES.DRIVING,
    label: "Driving",
    description: "Car, taxi, or rideshare",
  },
  {
    value: TRANSPORT_MODES.TRANSIT,
    label: "Public Transport",
    description: "Bus, train, metro, or tram",
  },
  {
    value: TRANSPORT_MODES.WALKING,
    label: "Walking",
    description: "On foot exploration",
  },
] as const;

// Transport preference options for form (includes auto option)
export const TRANSPORT_PREFERENCE_OPTIONS = [
  {
    value: TRANSPORT_PREFERENCES.AUTO,
    label: "Determine automatically",
    description: "Let AI choose the best transport for each day",
    iconPath: null, // No external icon for auto mode, use inline checkmark
    icon: `<svg fill="#000000" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
  },
  {
    value: TRANSPORT_PREFERENCES.DRIVING,
    label: "Driving",
    description: "Car, taxi, or rideshare",
    iconPath: "/icons/driving.svg",
  },
  {
    value: TRANSPORT_PREFERENCES.TRANSIT,
    label: "Public Transport",
    description: "Bus, train, metro, or tram",
    iconPath: "/icons/transit.svg",
  },
  {
    value: TRANSPORT_PREFERENCES.WALKING,
    label: "Walking",
    description: "On foot exploration",
    iconPath: "/icons/walking.svg",
  },
] as const;

// Utility functions
export function isValidTransportMode(mode: string): mode is TransportMode {
  return Object.values(TRANSPORT_MODES).includes(mode as TransportMode);
}

export function isValidTransportPreference(preference: string): preference is TransportPreference {
  return Object.values(TRANSPORT_PREFERENCES).includes(preference as TransportPreference);
}

// Convert preference to mode (strips out "auto" option)
export function preferenceToMode(preference: TransportPreference): TransportMode {
  if (preference === TRANSPORT_PREFERENCES.AUTO) {
    return TRANSPORT_MODES.DRIVING; // default fallback
  }
  return preference as TransportMode;
}