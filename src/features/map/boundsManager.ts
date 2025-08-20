/**
 * Map bounds management utilities for location-biased autocomplete
 */

export interface MapBounds {
  northeast: { lat: number; lng: number };
  southwest: { lat: number; lng: number };
}

export interface LocationBias {
  bounds?: MapBounds;
  lat?: number;
  lng?: number;
  radius?: number;
}

/**
 * Emit a DOM event with map bounds data
 */
export function emitMapBoundsChanged(bounds: MapBounds): void {
  if (typeof window === 'undefined') return;
  
  const event = new CustomEvent('map:boundsChanged', {
    detail: { bounds }
  });
  
  window.dispatchEvent(event);
  console.log('🗺️ Map bounds changed:', bounds);
}

/**
 * Listen for map bounds changes with automatic cleanup
 * @param callback Function to call when bounds change
 * @returns Cleanup function to remove the listener
 */
export function listenForBoundsChanges(callback: (bounds: MapBounds) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}; // No-op cleanup for server-side
  }

  const handleBoundsChange = (event: Event) => {
    const customEvent = event as CustomEvent<{ bounds: MapBounds }>;
    const { bounds } = customEvent.detail;
    
    if (isValidBounds(bounds)) {
      callback(bounds);
    } else {
      console.warn('🗺️ Invalid bounds received:', bounds);
    }
  };

  window.addEventListener('map:boundsChanged', handleBoundsChange);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('map:boundsChanged', handleBoundsChange);
  };
}

/**
 * Convert Google Maps bounds to autocomplete location bias format
 * Returns center point with radius for autocomplete API compatibility
 */
export function boundsToLocationBias(bounds: MapBounds): { lat: number; lng: number; radius: number } | undefined {
  if (!isValidBounds(bounds)) {
    console.warn('🗺️ Invalid bounds for location bias:', bounds);
    return undefined;
  }

  // Calculate center point of the bounds
  const centerLat = (bounds.northeast.lat + bounds.southwest.lat) / 2;
  const centerLng = (bounds.northeast.lng + bounds.southwest.lng) / 2;
  
  // Calculate approximate radius in meters
  // Use the distance from center to one of the corners
  const latDiff = Math.abs(bounds.northeast.lat - bounds.southwest.lat) / 2;
  const lngDiff = Math.abs(bounds.northeast.lng - bounds.southwest.lng) / 2;
  
  // Convert lat/lng differences to approximate meters
  // 1 degree latitude ≈ 111,111 meters
  // 1 degree longitude varies by latitude, but we use an approximation
  const latMeters = latDiff * 111111;
  const lngMeters = lngDiff * 111111 * Math.cos(centerLat * Math.PI / 180);
  
  // Use the larger of the two distances as radius
  const radius = Math.round(Math.max(latMeters, lngMeters));
  
  return {
    lat: centerLat,
    lng: centerLng,
    radius: Math.max(radius, 1000) // Minimum radius of 1km
  };
}

/**
 * Convert Google Maps LatLngBounds to our MapBounds interface
 */
export function googleBoundsToMapBounds(googleBounds: google.maps.LatLngBounds): MapBounds {
  return {
    northeast: {
      lat: googleBounds.getNorthEast().lat(),
      lng: googleBounds.getNorthEast().lng(),
    },
    southwest: {
      lat: googleBounds.getSouthWest().lat(),
      lng: googleBounds.getSouthWest().lng(),
    },
  };
}

/**
 * Validate that bounds are properly formatted
 */
function isValidBounds(bounds: MapBounds): boolean {
  if (!bounds || !bounds.northeast || !bounds.southwest) {
    return false;
  }

  const { northeast, southwest } = bounds;
  
  // Check that all coordinates are valid numbers
  if (
    typeof northeast.lat !== 'number' || 
    typeof northeast.lng !== 'number' ||
    typeof southwest.lat !== 'number' || 
    typeof southwest.lng !== 'number'
  ) {
    return false;
  }

  // Check that northeast is actually northeast of southwest
  if (northeast.lat <= southwest.lat || northeast.lng <= southwest.lng) {
    return false;
  }

  return true;
}

/**
 * Calculate bounds that contain all places in a specific day
 */
export function calculateDayBounds(
  places: Array<{ lat: number; lng: number; name: string }>
): MapBounds | null {
  if (places.length === 0) {
    console.warn('🗺️ calculateDayBounds: No places provided');
    return null;
  }

  if (places.length === 1) {
    // For single place, create small bounds around it
    const place = places[0];
    const offset = 0.01; // ~1km offset
    
    const bounds: MapBounds = {
      northeast: {
        lat: place.lat + offset,
        lng: place.lng + offset,
      },
      southwest: {
        lat: place.lat - offset,
        lng: place.lng - offset,
      },
    };

    console.log(`🗺️ calculateDayBounds: Single place bounds for ${place.name}`, bounds);
    return bounds;
  }

  // Calculate bounds for multiple places
  const lats = places.map(p => p.lat);
  const lngs = places.map(p => p.lng);
  
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Add padding to ensure places aren't on the edge
  const latPadding = Math.max((maxLat - minLat) * 0.1, 0.005); // 10% padding or minimum 0.5km
  const lngPadding = Math.max((maxLng - minLng) * 0.1, 0.005);

  const bounds: MapBounds = {
    northeast: {
      lat: maxLat + latPadding,
      lng: maxLng + lngPadding,
    },
    southwest: {
      lat: minLat - latPadding,
      lng: minLng - lngPadding,
    },
  };

  console.log(`🗺️ calculateDayBounds: Calculated bounds for ${places.length} places`, bounds);
  return bounds;
}

/**
 * Emit a custom event to fit map to specific bounds with optional maxZoom constraint
 */
export function emitFitDayBounds(
  bounds: MapBounds,
  maxZoom?: number
): void {
  if (typeof window === 'undefined') return;
  
  const event = new CustomEvent('map:fitDayBounds', {
    detail: { bounds, maxZoom }
  });
  
  window.dispatchEvent(event);
  console.log('🗺️ Fit day bounds event emitted:', { bounds, maxZoom });
}

/**
 * Emit a custom event to update direction line styles for selected day
 */
export function emitDirectionStyleUpdate(
  selectedDayIndex?: number
): void {
  if (typeof window === 'undefined') return;
  
  const event = new CustomEvent('map:updateDirectionStyles', {
    detail: { selectedDayIndex }
  });
  
  window.dispatchEvent(event);
  console.log('🗺️ Direction style update event emitted:', { selectedDayIndex });
}

/**
 * Debounce function to limit how often a function can be called
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T, 
  delay: number
): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
}