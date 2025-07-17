// Google Maps configuration settings (excluding center and zoom)
export interface MapConfiguration {
  mapTypeId: google.maps.MapTypeId;
  disableDefaultUI: boolean;
  zoomControl: boolean;
  mapTypeControl: boolean;
  scaleControl: boolean;
  streetViewControl: boolean;
  rotateControl: boolean;
  fullscreenControl: boolean;
  styles: google.maps.MapTypeStyle[];
}

// Tourist-friendly map styles
export const touristMapStyles: google.maps.MapTypeStyle[] = [
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
export const defaultMapOptions: MapConfiguration = {
  mapTypeId: google.maps.MapTypeId.ROADMAP,
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  scaleControl: true,
  streetViewControl: false,
  rotateControl: false,
  fullscreenControl: true,
  styles: touristMapStyles,
};
