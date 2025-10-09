"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleMap } from "./GoogleMap";
import { MapPlace } from "../types";
import {
  transformEditorDataToMapData,
  createEditorDataHash,
} from "../utils/dataTransform";
import { useItinerary } from "@/contexts/ItineraryContext";
import { TripDaysLegend } from "./TripDaysLegend";
import { RouteToggleButton } from "./RouteToggleButton";

interface EditorBlock {
  type: string;
  data: Record<string, unknown>;
}

interface ItineraryMapProps {
  editorData?: EditorBlock[]; // Editor.js blocks
  directionsData?: any[]; // Directions data from the editor
  onRefreshDirections?: () => Promise<void>; // Callback to refresh directions
  className?: string;
}

export function ItineraryMap({
  editorData = [],
  directionsData = [],
  onRefreshDirections,
  className = "",
}: ItineraryMapProps) {
  const { state, setSelectedPlace } = useItinerary();
  const selectedPlace = state.selectedPlace;

  // Initialize with all days visible
  const [visibleDays, setVisibleDays] = useState<Set<number>>(new Set());
  const [routesVisible, setRoutesVisible] = useState(true);

  // Create a stable hash to prevent unnecessary re-renders
  const dataHash = useMemo(() => {
    return createEditorDataHash(editorData);
  }, [editorData]);

  // Memoize the transformation to prevent infinite re-renders
  const mapData = useMemo(() => {
    const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(
      `🗺️ [${timestamp}] ItineraryMap: directionsData:`,
      directionsData?.length || 0,
      "routes"
    );

    if (editorData && editorData.length > 0) {
      console.log(
        `🗺️ [${timestamp}] ItineraryMap: Calling transformEditorDataToMapData...`
      );
      const result = transformEditorDataToMapData(editorData);

      // Add directions data if available
      if (directionsData && directionsData.length > 0) {
        result.directions = directionsData;
      }

      return result;
    }

    // Return empty data if no editor content
    const emptyResult = {
      days: [],
      places: [],
      directions: directionsData || [],
    };
    return emptyResult;
  }, [dataHash, directionsData]); // Back to using hash for optimization

  // Update visible days when days change
  useEffect(() => {
    const currentDayIndices = new Set(mapData.days.map((_, idx) => idx));

    // Initialize if empty, or add new days to visible set
    if (visibleDays.size === 0 || currentDayIndices.size !== visibleDays.size) {
      setVisibleDays(currentDayIndices);
    }
  }, [mapData.days.length]);

  const handlePlaceClick = useCallback(
    (place: MapPlace | null) => {
      // Handle deselection (place is null)
      if (place === null) {
        setSelectedPlace(null);
        return;
      }

      // Set the selected place in the context
      if (place.uid && place.dayIndex !== undefined) {
        const newSelection = { uid: place.uid, dayIndex: place.dayIndex };
        setSelectedPlace(newSelection);

        // Emit event for editor to scroll to place
        if (typeof window !== "undefined") {
          const event = new CustomEvent("map:placeClicked", {
            detail: {
              uid: place.uid,
              name: place.name,
              dayIndex: place.dayIndex,
            },
          });
          window.dispatchEvent(event);
        }
      }
    },
    [setSelectedPlace, selectedPlace]
  );

  const handleMapReady = useCallback((map: google.maps.Map) => {
    console.log("Map ready:", map);
    // DirectionsPolyRenderer is already created by GoogleMap, we just get the reference
  }, []);

  const handleRouteToggle = useCallback((visible: boolean) => {
    setRoutesVisible(visible);
    // The GoogleMap component will handle showing/hiding routes through its own directionsRendererRef
  }, []);

  const handleVisibilityChange = useCallback((newVisibleDays: Set<number>) => {
    setVisibleDays(newVisibleDays);
    // The GoogleMap component will handle re-rendering markers and routes through its effects
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Route Toggle Button and Trip Days Legend */}
      {mapData.days.length > 0 && (
        <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2 items-start">
          {/* Route Toggle Button */}
          <RouteToggleButton
            routesVisible={routesVisible}
            onToggle={handleRouteToggle}
          />

          {/* Trip Days Legend */}
          <TripDaysLegend
            days={mapData.days}
            visibleDays={visibleDays}
            onVisibilityChange={handleVisibilityChange}
          />
        </div>
      )}

      <GoogleMap
        data={mapData}
        onPlaceClick={handlePlaceClick}
        onMapReady={handleMapReady}
        onRefreshDirections={onRefreshDirections}
        selectedPlace={selectedPlace}
        visibleDays={visibleDays}
        routesVisible={routesVisible}
        className="w-full h-full"
      />
    </div>
  );
}
