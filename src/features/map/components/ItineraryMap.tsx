"use client";

import { useCallback, useMemo, useState } from "react";
import { GoogleMap } from "./GoogleMap";
import { MapPlace } from "../types";
import {
  transformEditorDataToMapData,
  createEditorDataHash,
} from "../utils/dataTransform";
import { useItinerary } from "@/contexts/ItineraryContext";

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
  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);

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
        console.log(
          `🗺️ [${timestamp}] ItineraryMap: Added ${directionsData.length} direction routes to result`
        );
      }

      console.log(
        `🗺️ [${timestamp}] ItineraryMap: transformation result:`,
        result
      );
      return result;
    }

    // Return empty data if no editor content
    const emptyResult = {
      days: [],
      places: [],
      directions: directionsData || [],
    };
    console.log(
      `🗺️ [${timestamp}] ItineraryMap: returning empty result:`,
      emptyResult
    );
    return emptyResult;
  }, [dataHash, directionsData]); // Back to using hash for optimization

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
    // Store map reference if needed for future operations
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Map Legend - Positioned lower and collapsible */}
      {mapData.days.length > 0 && (
        <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border max-w-xs">
          {/* Legend Header with Collapse Button */}
          <div className="flex items-center justify-between p-3 pb-2">
            <div className="text-sm font-medium text-slate-700">
              Trip Days ({mapData.days.length})
            </div>
            <button
              onClick={() => setIsLegendCollapsed(!isLegendCollapsed)}
              className="p-1 hover:bg-slate-100 rounded transition-colors"
              aria-label={
                isLegendCollapsed ? "Expand legend" : "Collapse legend"
              }
            >
              <svg
                className={`w-4 h-4 text-slate-600 transition-transform ${
                  isLegendCollapsed ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>

          {/* Legend Content - Collapsible */}
          {!isLegendCollapsed && (
            <div className="px-3 pb-3 space-y-2 max-h-48 overflow-y-auto">
              {mapData.days.map((day) => (
                <div
                  key={day.index}
                  className="flex items-center gap-2 text-xs"
                >
                  <div
                    className="w-3 h-3 rounded-full border border-white shadow-sm flex-shrink-0 day-color-indicator"
                    data-day-color={day.color}
                    aria-label={`Day color: ${day.color}`}
                  />
                  <span className="text-slate-600 truncate">
                    {day.title} {day.date && `(${day.date})`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Places Count */}
      {mapData.places.length > 0 && (
        <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border">
          <div className="text-xs text-slate-600">
            {mapData.places.length} place
            {mapData.places.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      <GoogleMap
        data={mapData}
        onPlaceClick={handlePlaceClick}
        onMapReady={handleMapReady}
        onRefreshDirections={onRefreshDirections}
        selectedPlace={selectedPlace}
        className="w-full h-full"
      />
    </div>
  );
}
