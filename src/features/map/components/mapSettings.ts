// Google Maps configuration settings (excluding center and zoom)
export const MAP_EVENTS_DEBOUNCE = 300; // 300ms debounce

// Bounds management settings
export const RESET_MAP_BOUNDS_ON_UPDATE = false; // Don't reset map bounds automatically - let hover interactions control bounds

// Max zoom level when focusing on day bounds
export const MAX_ZOOM_LEVEL = 1000;

export interface MapConfiguration {
  mapTypeId: any; // google.maps.MapTypeId
  disableDefaultUI: boolean;
  zoomControl: boolean;
  mapTypeControl: boolean;
  scaleControl: boolean;
  streetViewControl: boolean;
  rotateControl: boolean;
  fullscreenControl: boolean;
  gestureHandling: string;
  styles: any[]; // google.maps.MapTypeStyle[]
}

// Tourist-friendly map styles
export const getTouristMapStyles = (): any[] => [
  {
    featureType: "all",
    elementType: "labels",
    stylers: [{ visibility: "on" }],
  },
];

// Default map options for the itinerary map (without center and zoom)
export const getDefaultMapOptions = (): MapConfiguration => ({
  mapTypeId: google?.maps?.MapTypeId?.ROADMAP || "roadmap",
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  scaleControl: true,
  streetViewControl: false,
  rotateControl: false,
  fullscreenControl: true,
  gestureHandling: "greedy",
  styles: getTouristMapStyles(),
});
