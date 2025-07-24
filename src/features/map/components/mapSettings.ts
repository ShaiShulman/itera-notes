// Google Maps configuration settings (excluding center and zoom)
export const MAP_EVENTS_DEBOUNCE = 300; // 300ms debounce

// Bounds management settings
export const RESET_MAP_BOUNDS_ON_UPDATE = true; // Reset map bounds when places are modified

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
  styles: any[]; // google.maps.MapTypeStyle[]
}

// Tourist-friendly map styles
export const getTouristMapStyles = (): any[] => [
  // Hide less relevant POI categories for tourists
  {
    featureType: "poi.medical",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.government",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.school",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  // Show tourist-relevant POIs
  {
    featureType: "poi.attraction",
    elementType: "labels",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "poi.place_of_worship",
    elementType: "labels",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "poi.business",
    elementType: "labels",
    stylers: [{ visibility: "simplified" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels",
    stylers: [{ visibility: "on" }],
  },
  // Enhanced visibility for navigation
  {
    featureType: "water",
    elementType: "labels",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "road.arterial",
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
  styles: getTouristMapStyles(),
});
