"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { MapProps, MapPlace, GoogleMapInstance } from "../types";
import {
  createNumberedMarkerIcon,
  getDefaultPlaceColor,
  getDayColor,
} from "../utils/colors";
import { DirectionsPolyRenderer } from "../../directions/directionsPolyRenderer";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const DEFAULT_CENTER = { lat: 40.7128, lng: -74.006 }; // New York City default

// Debug logging
console.log(
  "Google Maps API Key:",
  GOOGLE_MAPS_API_KEY ? "✓ Set" : "✗ Missing"
);
console.log("Environment:", process.env.NODE_ENV);

export function GoogleMap({
  data,
  onPlaceClick,
  onMapReady,
  onRefreshDirections,
  className = "",
}: MapProps) {
  console.log("GoogleMap component rendering, data:", data);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<GoogleMapInstance | null>(null);
  const directionsRendererRef = useRef<DirectionsPolyRenderer | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  console.log("GoogleMap state - isLoaded:", isLoaded, "error:", error);

  // Callback ref to ensure we have the DOM element
  const setMapRef = React.useCallback((node: HTMLDivElement | null) => {
    mapRef.current = node;
    setMapContainer(node);
    console.log("Map container ref set:", !!node);
  }, []);

  // Initialize Google Maps when container is available
  useEffect(() => {
    console.log("GoogleMap initialization useEffect called!");
    console.log("mapContainer:", !!mapContainer);
    console.log("GOOGLE_MAPS_API_KEY length:", GOOGLE_MAPS_API_KEY.length);
    console.log("isLoaded:", isLoaded);
    console.log("existing mapInstanceRef:", !!mapInstanceRef.current);

    if (!GOOGLE_MAPS_API_KEY) {
      console.log("No API key, setting error");
      setError(
        "Google Maps API key is not configured. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file."
      );
      return;
    }

    if (!mapContainer) {
      console.log("Map container not available yet");
      return;
    }

    // Prevent multiple initialization
    if (mapInstanceRef.current) {
      console.log("Map already initialized, skipping");
      return;
    }

    console.log("Starting Google Maps initialization...");

    const loader = new Loader({
      apiKey: GOOGLE_MAPS_API_KEY,
      version: "weekly",
      libraries: ["places", "geometry"],
    });

    console.log("Google Maps Loader created, attempting to load...");

    loader
      .load()
      .then(() => {
        console.log("Google Maps API loaded successfully!");

        if (!mapContainer) {
          console.log("Map container is null, cannot create map");
          return;
        }

        if (mapInstanceRef.current) {
          console.log("Map already exists, skipping creation");
          return;
        }

        // Calculate center and zoom based on places
        const center = calculateMapCenter(data.places);
        const zoom = calculateMapZoom(data.places);

        console.log("Creating map with center:", center, "zoom:", zoom);

        const map = new google.maps.Map(mapContainer, {
          center,
          zoom,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          scaleControl: true,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: true,
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }],
            },
          ],
        });

        console.log("Map created successfully!");

        mapInstanceRef.current = {
          map,
          markers: [],
          directionsRenderers: [],
        };

        // Initialize directions polyline renderer
        directionsRendererRef.current = new DirectionsPolyRenderer(map);

        setIsLoaded(true);
        onMapReady?.(map);
      })
      .catch((error) => {
        console.error("Failed to load Google Maps:", error);
        console.error("Error details:", error.message, error.code);
        setError(`Failed to load Google Maps: ${error.message}`);
      });

    // Cleanup function
    return () => {
      if (mapInstanceRef.current) {
        console.log("Cleaning up map instance");
        mapInstanceRef.current.markers?.forEach((marker) =>
          marker.setMap(null)
        );
        mapInstanceRef.current.directionsRenderers?.forEach((renderer) =>
          renderer.setMap(null)
        );
        mapInstanceRef.current = null;
      }
      if (directionsRendererRef.current) {
        console.log("Cleaning up directions renderer");
        directionsRendererRef.current.clearPolylines();
        directionsRendererRef.current = null;
      }
    };
  }, [mapContainer, onMapReady]);

  console.log(
    "About to render GoogleMap, isLoaded:",
    isLoaded,
    "error:",
    error
  );

  // Update markers when data changes (optimized to avoid unnecessary updates)
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;

    const { map, markers } = mapInstanceRef.current;

    console.log(`🗺️ GoogleMap: Updating ${data.places.length} markers`);

    // Clear existing markers
    markers.forEach((marker) => marker.setMap(null));
    markers.length = 0;

    // Add markers for each place
    data.places.forEach((place, index) => {
      if (
        !place.coordinates ||
        typeof place.coordinates.lat !== "number" ||
        typeof place.coordinates.lng !== "number" ||
        isNaN(place.coordinates.lat) ||
        isNaN(place.coordinates.lng)
      ) {
        console.log(`⚠️ Place ${place.name} has invalid coordinates, skipping`);
        return;
      }

      // Use place-specific color or fallback to day color or default
      const color =
        place.color ||
        (place.dayIndex !== undefined
          ? getDayColor(place.dayIndex)
          : getDefaultPlaceColor());

      // Use place number within day or global index
      const markerNumber = place.placeNumberInDay || index + 1;

      // Ensure coordinates are in the correct LatLngLiteral format
      const position = {
        lat: Number(place.coordinates.lat),
        lng: Number(place.coordinates.lng),
      };

      const marker = new google.maps.Marker({
        position,
        map,
        title: place.name,
        icon: {
          url: createNumberedMarkerIcon(color, markerNumber),
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 32),
        },
        animation: google.maps.Animation.DROP,
      });

      // Add click listener
      marker.addListener("click", () => {
        console.log("📍 Marker clicked:", place.name);
        if (onPlaceClick) {
          onPlaceClick(place);
        }
      });

      markers.push(marker);
      console.log(`📍 Marker ${markerNumber}: ${place.name} (${color})`);
    });

    console.log(`✅ Created ${markers.length} markers`);

    // Adjust map bounds if there are places
    if (data.places.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      const validPlaces = data.places.filter((place) => {
        return (
          place.coordinates &&
          typeof place.coordinates.lat === "number" &&
          typeof place.coordinates.lng === "number" &&
          !isNaN(place.coordinates.lat) &&
          !isNaN(place.coordinates.lng)
        );
      });

      if (validPlaces.length > 0) {
        validPlaces.forEach((place) => {
          // Ensure coordinates are in the correct LatLngLiteral format
          const latLng = {
            lat: Number(place.coordinates.lat),
            lng: Number(place.coordinates.lng),
          };
          bounds.extend(latLng);
        });

        try {
          map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
        } catch (error) {
          console.error("Error fitting bounds:", error);
          console.error("Bounds:", bounds);
          console.error("Valid places:", validPlaces);
        }
      }
    }

    mapInstanceRef.current.markers = markers;
  }, [data, isLoaded, onPlaceClick]);

  // Update directions when directions data changes
  useEffect(() => {
    console.log("🔄 Directions useEffect triggered", {
      isLoaded,
      mapInstance: !!mapInstanceRef.current,
      directionsCount: data.directions?.length || 0,
      directions: data.directions,
    });

    if (!isLoaded || !mapInstanceRef.current) {
      console.log("🔄 Directions useEffect early return", {
        isLoaded,
        mapInstance: !!mapInstanceRef.current,
      });
      return;
    }

    console.log(
      `🗺️ GoogleMap: Updating directions - ${
        data.directions?.length || 0
      } day routes`
    );

    // Use DirectionsPolyRenderer to handle directions
    if (directionsRendererRef.current) {
      // Clear existing polylines
      directionsRendererRef.current.clearPolylines();

      // Render new directions if available
      if (data.directions && data.directions.length > 0) {
        directionsRendererRef.current.renderDirections(data.directions);
      }
    }

    console.log(
      "🔄 Directions useEffect completed - using DirectionsPolyRenderer"
    );
  }, [data.directions, isLoaded]);

  if (error) {
    console.log("Rendering error state:", error);
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 rounded-lg ${className}`}
      >
        <div className="text-center p-8 max-w-md">
          <div className="text-red-500 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <p className="text-slate-800 font-semibold mb-2">
            Map Configuration Error
          </p>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          {error.includes("API key") && (
            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border">
              <p className="font-medium mb-2">Quick Setup:</p>
              <ol className="text-left space-y-1">
                <li>1. Create .env.local file in project root</li>
                <li>2. Add: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key</li>
                <li>3. Get API key from Google Cloud Console</li>
                <li>4. Enable Maps JavaScript API & Places API</li>
                <li>5. Restart development server</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    );
  }

  console.log("Rendering map container");

  // Handle refresh button click
  const handleRefresh = async () => {
    if (!onRefreshDirections || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefreshDirections();
    } catch (error) {
      console.error("Error refreshing directions:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Map Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-white/90 backdrop-blur-sm border-b border-slate-200 rounded-t-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium text-slate-700">
              Interactive Map
            </span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || data.places.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
            title="Calculate driving directions"
          >
            <svg
              className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isRefreshing ? "Calculating..." : "Refresh Routes"}
          </button>
        </div>
      </div>

      <div ref={setMapRef} className="w-full h-full rounded-lg pt-12" />

      {/* Loading overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg pt-12">
          <div className="text-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600 font-medium">Loading Map...</p>
          </div>
        </div>
      )}

      {/* No places overlay */}
      {isLoaded && data.places.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 rounded-lg pt-12">
          <div className="text-center p-8">
            <div className="text-slate-400 mb-4">
              <svg
                className="w-12 h-12 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <p className="text-slate-600 font-medium">No Places Added</p>
            <p className="text-sm text-slate-500">
              Start adding places to your itinerary to see them on the map
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions
function calculateMapCenter(places: MapPlace[]): { lat: number; lng: number } {
  if (places.length === 0) return DEFAULT_CENTER;

  const validPlaces = places.filter((place) => place.coordinates);
  if (validPlaces.length === 0) return DEFAULT_CENTER;

  const totalLat = validPlaces.reduce(
    (sum, place) => sum + place.coordinates.lat,
    0
  );
  const totalLng = validPlaces.reduce(
    (sum, place) => sum + place.coordinates.lng,
    0
  );

  return {
    lat: totalLat / validPlaces.length,
    lng: totalLng / validPlaces.length,
  };
}

function calculateMapZoom(places: MapPlace[]): number {
  if (places.length === 0) return 10;
  if (places.length === 1) return 12;

  const validPlaces = places.filter((place) => place.coordinates);
  if (validPlaces.length <= 1) return 12;

  // Calculate bounding box
  const lats = validPlaces.map((place) => place.coordinates.lat);
  const lngs = validPlaces.map((place) => place.coordinates.lng);

  const latRange = Math.max(...lats) - Math.min(...lats);
  const lngRange = Math.max(...lngs) - Math.min(...lngs);
  const maxRange = Math.max(latRange, lngRange);

  // Determine zoom level based on range
  if (maxRange > 10) return 5;
  if (maxRange > 5) return 6;
  if (maxRange > 2) return 7;
  if (maxRange > 1) return 8;
  if (maxRange > 0.5) return 9;
  if (maxRange > 0.2) return 10;
  if (maxRange > 0.1) return 11;
  return 12;
}
