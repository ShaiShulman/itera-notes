/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useMemo } from "react";
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

  // Create a stable hash to prevent unnecessary re-renders
  const dataHash = useMemo(() => {
    return createEditorDataHash(editorData);
  }, [editorData]);

  // Memoize the transformation to prevent infinite re-renders
  const mapData = useMemo(() => {
    console.log("🗺️ ItineraryMap: transforming editorData:", editorData);
    console.log("🗺️ ItineraryMap: data hash:", dataHash);

    if (editorData && editorData.length > 0) {
      const result = transformEditorDataToMapData(editorData);

      // Add directions data if available
      if (directionsData && directionsData.length > 0) {
        result.directions = directionsData;
      }

      console.log("🗺️ ItineraryMap: transformation result:", result);
      return result;
    }

    // Return empty data if no editor content
    const emptyResult = {
      days: [],
      places: [],
      directions: directionsData || [],
    };
    console.log("🗺️ ItineraryMap: returning empty result:", emptyResult);
    return emptyResult;
  }, [dataHash, directionsData]); // Include directionsData in dependencies

  const handlePlaceClick = useCallback(
    (place: MapPlace | null) => {
      console.log("📍 ItineraryMap: Place clicked:", place);

      // Handle deselection (place is null)
      if (place === null) {
        setSelectedPlace(null);
        console.log("📍 ItineraryMap: Deselected all places");
        return;
      }

      // Set the selected place in the context
      if (place.uid && place.dayIndex !== undefined) {
        setSelectedPlace({ uid: place.uid, dayIndex: place.dayIndex });
        console.log(
          `📍 ItineraryMap: Set selected place - uid: ${place.uid}, dayIndex: ${place.dayIndex}`
        );
      } else {
        console.warn(
          "📍 ItineraryMap: Place clicked but missing uid or dayIndex:",
          place
        );
      }
    },
    [setSelectedPlace]
  );

  const handleMapReady = useCallback((map: google.maps.Map) => {
    console.log("Map ready:", map);
    // Store map reference if needed for future operations
  }, []);

  console.log("ItineraryMap: About to render GoogleMap with data:", mapData);

  return (
    <div className={`relative ${className}`}>
      {/* Map Legend */}
      {mapData.days.length > 0 && (
        <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border">
          <div className="text-sm font-medium text-slate-700 mb-2">
            Trip Days
          </div>
          <div className="space-y-1">
            {mapData.days.map((day) => (
              <div key={day.index} className="flex items-center gap-2 text-xs">
                <div
                  className="w-3 h-3 rounded-full border border-white shadow-sm"
                  style={{ backgroundColor: day.color }}
                />
                <span className="text-slate-600">
                  {day.title} {day.date && `(${day.date})`}
                </span>
              </div>
            ))}
          </div>
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
