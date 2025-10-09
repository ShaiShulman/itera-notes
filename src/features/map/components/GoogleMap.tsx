"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { MapProps, MapPlace, GoogleMapInstance } from "../types";
import {
  createNumberedMarkerIcon,
  getDefaultPlaceColor,
  getDayColor,
} from "../utils/colors";
import { DirectionsPolyRenderer } from "../../directions/directionsPolyRenderer";
import { getPlaceDetailsAction } from "@/features/editor/actions/places";
import { PlaceLocation } from "@/services/openai/itinerary";
import { useItinerary } from "@/contexts/ItineraryContext";
import { AddPlacePopup } from "./AddPlacePopup";
import { PlacePopupState } from "./types";
import {
  getDefaultMapOptions,
  MAP_EVENTS_DEBOUNCE,
  RESET_MAP_BOUNDS_ON_UPDATE,
} from "./mapSettings";
import { emitMapBoundsChanged, debounce, MapBounds } from "../boundsManager";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const DEFAULT_CENTER = { lat: 40.7128, lng: -74.006 }; // New York City default

export const GoogleMap = React.memo(
  function GoogleMap({
    data,
    onPlaceClick,
    onMapReady,
    selectedPlace,
    visibleDays,
    routesVisible = true,
    className = "",
  }: MapProps) {
    console.log("GoogleMap component rendering, data:", data);

    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<GoogleMapInstance | null>(null);
    const directionsRendererRef = useRef<DirectionsPolyRenderer | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(
      null
    );
    const [originalBounds, setOriginalBounds] =
      useState<google.maps.LatLngBounds | null>(null);
    const [selectedMarker, setSelectedMarker] =
      useState<google.maps.Marker | null>(null);
    const [placePopup, setPlacePopup] = useState<PlacePopupState>({
      isOpen: false,
      position: null,
      placeName: "",
      placeData: null,
      isLoading: false,
    });

    // Get the itinerary context at the component level
    const { addPlace } = useItinerary();

    console.log("GoogleMap state - isLoaded:", isLoaded, "error:", error);

    // Callback ref to ensure we have the DOM element
    const setMapRef = React.useCallback((node: HTMLDivElement | null) => {
      mapRef.current = node;
      setMapContainer(node);
      console.log("Map container ref set:", !!node);
    }, []);

    // Close popup when clicking outside
    const closePopup = useCallback(() => {
      setPlacePopup({
        isOpen: false,
        position: null,
        placeName: "",
        placeData: null,
        isLoading: false,
      });
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
            ...getDefaultMapOptions(),
          });

          mapInstanceRef.current = {
            map,
            markers: [],
            directionsRenderers: [],
          };

          directionsRendererRef.current = new DirectionsPolyRenderer(map);

          // Set up bounds change detection for autocomplete biasing
          const handleBoundsChanged = debounce(() => {
            const bounds = map.getBounds();
            if (bounds) {
              const mapBounds: MapBounds = {
                northeast: {
                  lat: bounds.getNorthEast().lat(),
                  lng: bounds.getNorthEast().lng(),
                },
                southwest: {
                  lat: bounds.getSouthWest().lat(),
                  lng: bounds.getSouthWest().lng(),
                },
              };
              emitMapBoundsChanged(mapBounds);
            }
          }, MAP_EVENTS_DEBOUNCE);

          // Listen for map bounds changes
          map.addListener("bounds_changed", handleBoundsChanged);
          map.addListener("zoom_changed", handleBoundsChanged);

          // Listen for day-specific bounds fitting
          const handleFitDayBounds = (event: CustomEvent) => {
            const { bounds, maxZoom } = event.detail;
            const timestamp = new Date()
              .toISOString()
              .split("T")[1]
              .split(".")[0];
            console.log(
              `📡 [${timestamp}] GoogleMap: Received fit day bounds event`,
              {
                bounds,
                maxZoom,
              }
            );

            if (bounds) {
              console.log(`🗺️ [${timestamp}] GoogleMap: Current map state:`, {
                center: {
                  lat: map.getCenter()?.lat(),
                  lng: map.getCenter()?.lng(),
                },
                zoom: map.getZoom(),
                bounds: {
                  ne: {
                    lat: map.getBounds()?.getNorthEast().lat(),
                    lng: map.getBounds()?.getNorthEast().lng(),
                  },
                  sw: {
                    lat: map.getBounds()?.getSouthWest().lat(),
                    lng: map.getBounds()?.getSouthWest().lng(),
                  },
                },
              });

              // Convert bounds to Google Maps LatLngBounds
              const googleBounds = new google.maps.LatLngBounds(
                new google.maps.LatLng(
                  bounds.southwest.lat,
                  bounds.southwest.lng
                ),
                new google.maps.LatLng(
                  bounds.northeast.lat,
                  bounds.northeast.lng
                )
              );

              console.log(
                `🗺️ [${timestamp}] GoogleMap: Applying fitBounds to:`,
                {
                  sw: { lat: bounds.southwest.lat, lng: bounds.southwest.lng },
                  ne: { lat: bounds.northeast.lat, lng: bounds.northeast.lng },
                }
              );

              // Fit bounds with padding
              map.fitBounds(googleBounds, {
                top: 50,
                right: 50,
                bottom: 50,
                left: 50,
              });

              // Check zoom level after fitBounds and constrain if necessary
              if (maxZoom !== undefined) {
                const checkAndConstrainZoom = () => {
                  const currentZoom = map.getZoom();
                  console.log(
                    `🗺️ [${timestamp}] GoogleMap: Post-fitBounds zoom: ${currentZoom}, maxZoom: ${maxZoom}`
                  );
                  if (currentZoom !== undefined && currentZoom > maxZoom) {
                    console.log(
                      `🗺️ [${timestamp}] Constraining zoom from ${currentZoom} to ${maxZoom}`
                    );
                    map.setZoom(maxZoom);
                  }
                };

                // Add a brief delay to ensure fitBounds has completed
                setTimeout(checkAndConstrainZoom, 100);
              }

              console.log(
                `✅ [${timestamp}] GoogleMap: Applied day bounds fitting`
              );
            } else {
              console.warn(`⚠️ [${timestamp}] GoogleMap: No bounds provided`);
            }
          };

          // Handle direction style updates
          const handleDirectionStyleUpdate = (event: CustomEvent) => {
            const { selectedDayIndex } = event.detail;
            console.log("📡 map:updateDirectionStyles received:", {
              selectedDayIndex,
            });

            if (directionsRendererRef.current) {
              // Use the new day-specific styling method
              directionsRendererRef.current.updateDaySpecificStyles(
                selectedDayIndex
              );

              // If routes are hidden, update visibility based on current state
              if (!routesVisible) {
                directionsRendererRef.current.setRoutesVisible(
                  false,
                  selectedDayIndex
                );
              }
            }
          };

          // Add window event listener for day bounds fitting
          if (typeof window !== "undefined") {
            window.addEventListener(
              "map:fitDayBounds",
              handleFitDayBounds as EventListener
            );
            window.addEventListener(
              "map:updateDirectionStyles",
              handleDirectionStyleUpdate as EventListener
            );
          }

          // POI click handler - triggers only when clicking on Google Maps POIs
          map.addListener(
            "click",
            (event: google.maps.MapMouseEvent & { placeId?: string }) => {
              console.log("📍 Map clicked:", event);

              // Close any existing popup first
              closePopup();

              // Check if click was on a POI (point of interest)
              if (event.placeId) {
                console.log("📍 Clicked on POI with place_id:", event.placeId);

                // Prevent default POI info window
                event.stop?.();

                // Show popup with loading state immediately
                setPlacePopup({
                  isOpen: true,
                  position: event.latLng!.toJSON(),
                  placeName: "Loading...",
                  placeData: null,
                  isLoading: true,
                });

                // Fetch detailed place information using placeId with internal API
                fetchPlaceDetails(event.placeId!, "");
              } else {
                console.log(
                  "📍 Regular map click - deselecting any selected places"
                );
                // If no POI clicked, deselect any selected places
                if (onPlaceClick) {
                  onPlaceClick(null as any);
                }
              }
            }
          );

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
        // Cleanup event listeners
        if (typeof window !== "undefined") {
          window.removeEventListener("map:fitDayBounds", () => {});
          window.removeEventListener("map:updateDirectionStyles", () => {});
        }
      };
    }, [mapContainer, onMapReady, closePopup]);

    // Function to fetch place details using placeId
    const fetchPlaceDetails = async (placeId: string, placeName: string) => {
      try {
        console.log(
          "🔍 Fetching place details for placeId:",
          placeId,
          "name:",
          placeName
        );

        const placeDetails = await getPlaceDetailsAction(placeId);

        if (placeDetails) {
          console.log("✅ Place details found:", placeDetails.name);

          // Store raw photo references (not URLs) - extract 3 for consistency
          const photoReferences = (placeDetails.photos || [])
            .slice(0, 3)
            .map((photo) => photo.photo_reference);

          // Get thumbnail reference for first photo
          const thumbnailUrl =
            placeDetails.photos && placeDetails.photos.length > 0
              ? placeDetails.photos[0].photo_reference
              : undefined;

          const placeData: PlaceLocation = {
            name: placeDetails.name,
            lat: placeDetails.geometry.location.lat,
            lng: placeDetails.geometry.location.lng,
            placeId: placeDetails.place_id,
            address: placeDetails.formatted_address,
            rating: placeDetails.rating,
            photoReferences,
            description: placeDetails.editorial_summary?.overview,
            thumbnailUrl,
            status: "found",
            type: placeDetails.types?.some((type) =>
              [
                "lodging",
                "hotel",
                "hostel",
                "resort",
                "motel",
                "bed_and_breakfast",
                "guest_house",
                "apartment_complex",
              ].includes(type)
            )
              ? "hotel"
              : "place",
          };

          setPlacePopup((prev) => ({
            ...prev,
            placeName: placeDetails.name,
            placeData,
            isLoading: false,
          }));
        } else {
          console.log("⚠️ Place details not found");

          // Close popup and show error - place not found
          setPlacePopup({
            isOpen: false,
            position: null,
            placeName: "",
            placeData: null,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error("❌ Error fetching place details:", error);

        // Close popup on error
        setPlacePopup({
          isOpen: false,
          position: null,
          placeName: "",
          placeData: null,
          isLoading: false,
        });
      }
    };

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

      // Create a stable hash of the places data to check if markers need recreation
      const placesHash = JSON.stringify(
        data.places.map((p) => ({
          uid: p.uid,
          name: p.name,
          coordinates: p.coordinates,
          hideInMap: p.hideInMap,
          dayIndex: p.dayIndex,
        }))
      );

      // Check if places data changed (requires full marker recreation)
      const lastPlacesHash = mapInstanceRef.current.lastPlacesHash;
      const placesDataChanged = lastPlacesHash !== placesHash;

      if (placesDataChanged) {
        console.log(
          `🗺️ GoogleMap: Recreating ${data.places.length} markers - places data changed`
        );
        mapInstanceRef.current.lastPlacesHash = placesHash;

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
            console.log(
              `⚠️ Place ${place.name} has invalid coordinates, skipping`
            );
            return;
          }

          // Skip places that are hidden from map
          if (place.hideInMap) {
            console.log(`👁️ Skipping hidden place: ${place.name}`);
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

          // Format the marker display based on type
          let markerDisplay: string;
          if (place.type === "hotel") {
            // Convert number to letter: 1->A, 2->B, 3->C, etc.
            markerDisplay = String.fromCharCode(64 + markerNumber);
          } else {
            // Use regular numbers for places
            markerDisplay = markerNumber.toString();
          }

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
              url: createNumberedMarkerIcon(color, markerDisplay),
              scaledSize: new google.maps.Size(32, 32),
              anchor: new google.maps.Point(16, 32),
            },
            animation: google.maps.Animation.DROP,
          });

          // Store dayIndex in marker for efficient visibility toggling
          (marker as any).dayIndex = place.dayIndex;
          (marker as any).placeUid = place.uid;

          // Add click listener
          marker.addListener("click", () => {
            if (onPlaceClick) {
              onPlaceClick(place);
            }
          });

          markers.push(marker);
        });
      } else {
        // Places data hasn't changed, just update marker visibility based on visibleDays
        markers.forEach((marker) => {
          const dayIndex = (marker as any).dayIndex;
          const shouldBeVisible =
            dayIndex === undefined || !visibleDays || visibleDays.has(dayIndex);

          // Only update if visibility changed
          const currentlyVisible = marker.getMap() !== null;
          if (shouldBeVisible !== currentlyVisible) {
            marker.setMap(shouldBeVisible ? map : null);
          }
        });
      }

      // Adjust map bounds if there are places and auto-bounds is enabled
      if (data.places.length > 0 && RESET_MAP_BOUNDS_ON_UPDATE) {
        const bounds = new google.maps.LatLngBounds();
        const validPlaces = data.places.filter((place) => {
          return (
            place.coordinates &&
            typeof place.coordinates.lat === "number" &&
            typeof place.coordinates.lng === "number" &&
            !isNaN(place.coordinates.lat) &&
            !isNaN(place.coordinates.lng) &&
            !place.hideInMap && // Exclude hidden places from bounds
            // Exclude places from hidden days
            (place.dayIndex === undefined ||
              !visibleDays ||
              visibleDays.has(place.dayIndex))
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
            setOriginalBounds(bounds);
            console.log(
              "🗺️ Map bounds reset due to RESET_MAP_BOUNDS_ON_UPDATE=true"
            );
          } catch (error) {
            console.error("Error fitting bounds:", error);
            console.error("Bounds:", bounds);
            console.error("Valid places:", validPlaces);
          }
        }
      } else if (data.places.length > 0) {
        console.log(
          "🗺️ Map bounds NOT reset due to RESET_MAP_BOUNDS_ON_UPDATE=false"
        );
      }

      mapInstanceRef.current.markers = markers;
    }, [data, isLoaded, onPlaceClick, visibleDays]);

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

        // Render new directions if available and routes are visible
        if (data.directions && data.directions.length > 0 && routesVisible) {
          // Filter directions based on visible days
          const visibleDirections = visibleDays
            ? data.directions.filter((direction) =>
                visibleDays.has(direction.dayIndex)
              )
            : data.directions;

          directionsRendererRef.current.renderDirections(visibleDirections);
        }
      }

      console.log(
        "🔄 Directions useEffect completed - using DirectionsPolyRenderer"
      );
    }, [data.directions, isLoaded, visibleDays, routesVisible]);

    // Handle place selection for map centering and marker animation
    useEffect(() => {
      if (!isLoaded || !mapInstanceRef.current) return;

      const { map, markers } = mapInstanceRef.current;

      // Clear previous selected marker animation
      if (selectedMarker) {
        selectedMarker.setAnimation(null);
        setSelectedMarker(null);
      }

      if (selectedPlace) {
        // Find the marker for the selected place
        const selectedPlaceData = data.places.find(
          (place) => place.uid === selectedPlace.uid
        );
        if (!selectedPlaceData) return;

        const markerIndex = data.places.findIndex(
          (place) => place.uid === selectedPlace.uid
        );
        const marker = markers[markerIndex];

        if (marker) {
          // Center map on the selected place with moderate zoom
          const placePosition = {
            lat: selectedPlaceData.coordinates.lat,
            lng: selectedPlaceData.coordinates.lng,
          };

          map.setCenter(placePosition);

          // Make marker jump with animation
          marker.setAnimation(google.maps.Animation.BOUNCE);
          setSelectedMarker(marker);

          // Stop the bounce animation after 3 seconds
          setTimeout(() => {
            if (marker) {
              marker.setAnimation(null);
            }
          }, 3000);
        }
      } else {
        // if (originalBounds) {
        //   map.fitBounds(originalBounds);
        // }
      }
    }, [selectedPlace, isLoaded, data.places, originalBounds, selectedMarker]);

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

    return (
      <div className={`relative ${className}`}>
        <div ref={setMapRef} className="w-full h-full rounded-lg" />

        {/* Loading overlay */}
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg">
            <div className="text-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600 font-medium">Loading Map...</p>
            </div>
          </div>
        )}

        {/* No places overlay */}
        {isLoaded && data.places.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 rounded-lg">
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

        {/* Backdrop overlay - within map */}
        {placePopup.isOpen && (
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-40 pointer-events-auto"
            onClick={closePopup}
          />
        )}

        {/* Add Place Drawer (Bottom) - within map */}
        {placePopup.isOpen && placePopup.position && (
          <div className="absolute bottom-0 left-0 right-0 z-50 pointer-events-auto">
            <AddPlacePopup
              isOpen={placePopup.isOpen}
              position={placePopup.position}
              placeName={placePopup.placeName}
              placeData={placePopup.placeData}
              isLoading={placePopup.isLoading}
              onClose={closePopup}
              onAddToDay={(dayNumber, place) => {
                console.log(
                  `🗺️ GoogleMap: Adding place to Day ${dayNumber}:`,
                  place
                );

                // Use the ItineraryContext to add the place
                addPlace(dayNumber, place);

                closePopup();
              }}
            />
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison to prevent unnecessary re-renders
    // Only re-render if places data, selectedPlace, visibleDays, routesVisible, or className actually changed
    const placesEqual =
      JSON.stringify(prevProps.data.places) ===
      JSON.stringify(nextProps.data.places);
    const directionsEqual =
      JSON.stringify(prevProps.data.directions) ===
      JSON.stringify(nextProps.data.directions);
    const selectedPlaceEqual =
      prevProps.selectedPlace?.uid === nextProps.selectedPlace?.uid &&
      prevProps.selectedPlace?.dayIndex === nextProps.selectedPlace?.dayIndex;
    const classNameEqual = prevProps.className === nextProps.className;
    const routesVisibleEqual =
      prevProps.routesVisible === nextProps.routesVisible;

    // Compare visibleDays Sets
    const visibleDaysEqual =
      prevProps.visibleDays === nextProps.visibleDays ||
      (prevProps.visibleDays?.size === nextProps.visibleDays?.size &&
        Array.from(prevProps.visibleDays || []).every((day) =>
          nextProps.visibleDays?.has(day)
        ));

    const shouldRerender = !(
      placesEqual &&
      directionsEqual &&
      selectedPlaceEqual &&
      classNameEqual &&
      visibleDaysEqual &&
      routesVisibleEqual
    );

    return !shouldRerender;
  }
);

// Helper functions
function calculateMapCenter(places: MapPlace[]): { lat: number; lng: number } {
  if (places.length === 0) return DEFAULT_CENTER;

  const validPlaces = places.filter(
    (place) => place.coordinates && !place.hideInMap
  );
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

  const validPlaces = places.filter(
    (place) => place.coordinates && !place.hideInMap
  );
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
