/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MapIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useItinerary } from "@/contexts/ItineraryContext";
import { convertItineraryToEditorData } from "@/app/create-itinerary/utils/editorConverter";

// Import from feature structure
const ItineraryEditor = dynamic(
  () => import("@/features/editor/components/ItineraryEditor"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Loading ItineraryEditor component...</p>
        </div>
      </div>
    ),
  }
);

// Import types from feature
import type { EditorData } from "@/features/editor/types";

// Import map component
const ItineraryMap = dynamic(
  () =>
    import("@/features/map/components/ItineraryMap").then((mod) => ({
      default: mod.ItineraryMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Loading map...</p>
        </div>
      </div>
    ),
  }
);

export default function ItineraryPlanner() {
  const router = useRouter();
  const { state } = useItinerary();
  const [editorData, setEditorData] = useState<EditorData | undefined>();
  const [directionsData, setDirectionsData] = useState<any[]>([]);
  const editorRefreshFnRef = useRef<(() => Promise<any>) | null>(null);

  // Redirect to create-itinerary if no itinerary exists
  useEffect(() => {
    if (!state.currentItinerary && !state.editorData) {
      console.log("📝 No itinerary found, redirecting to create-itinerary");
      router.push("/create-itinerary");
      return;
    }
  }, [state.currentItinerary, state.editorData, router]);

  // Load editor data from context whenever it changes
  useEffect(() => {
    if (state.editorData) {
      console.log("📝 Loading itinerary from context:", state.editorData);
      setEditorData(state.editorData);
    }
  }, [state.editorData]);

  // Convert currentItinerary to editorData if we have itinerary but no editorData
  useEffect(() => {
    if (state.currentItinerary && !state.editorData) {
      console.log("📝 Converting current itinerary to editor data");
      const editorData = convertItineraryToEditorData(state.currentItinerary);
      setEditorData(editorData);
    }
  }, [state.currentItinerary, state.editorData]);

  // Log editor data changes for debugging
  useEffect(() => {
    console.log("🗺️ Main page: Current editorData:", editorData);
    console.log(
      "🗺️ Main page: Blocks being passed to map:",
      editorData?.blocks
    );
  }, [editorData]);

  const handleEditorChange = (data: EditorData) => {
    console.log("📝 Main page: Editor data changed:", data);
    console.log("📝 Main page: Editor blocks:", data.blocks);
    console.log("📝 Main page: Number of blocks:", data.blocks?.length);

    setEditorData(data);
    // TODO: Extract places for map visualization
    console.log("📝 Main page: Updated editorData state");
  };

  // Stable callback for when refresh function is ready
  const handleRefreshReady = useCallback((refreshFn: () => Promise<any>) => {
    console.log("🚗 Main page: Refresh function received from editor");
    editorRefreshFnRef.current = refreshFn;
  }, []);

  // Create refresh directions callback
  const handleRefreshDirections = useCallback(async () => {
    console.log("🚗 Main page: Refresh directions requested");

    if (!editorRefreshFnRef.current) {
      console.warn("🚗 Main page: No editor refresh function available");
      return;
    }

    try {
      const result = await editorRefreshFnRef.current();
      const { directions, updatedPlaces } = result;

      console.log(
        `🚗 Main page: Received ${directions.length} direction routes`
      );
      console.log(
        `🚗 Main page: Updated ${updatedPlaces.length} places with driving times`
      );

      setDirectionsData(directions);

      // Optionally trigger editor re-render to show updated driving times
      // The place blocks should update themselves via the event system
    } catch (error) {
      console.error("🚗 Main page: Error refreshing directions:", error);
      // TODO: Show user error notification
    }
  }, []);

  console.log("ItineraryPlanner: Component rendering");
  console.log("🔍 Debug state:", {
    hasCurrentItinerary: !!state.currentItinerary,
    hasEditorData: !!state.editorData,
    localEditorData: !!editorData,
    editorDataBlocks: editorData?.blocks?.length || 0,
  });
  console.log(
    "🔍 Full editorData being passed to ItineraryEditor:",
    editorData
  );

  // Show loading state while redirecting or if no itinerary
  if (!state.currentItinerary && !state.editorData && !editorData) {
    console.log("📝 No data found anywhere, redirecting...");
    return (
      <div className="h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-2 overflow-hidden">
      {/* Main Content - Card with minimal padding, accounting for nav bar */}
      <div className="h-[calc(100vh-64px-2rem)]">
        {/* Single Horizontally Divided Card */}
        <div className="h-full bg-white shadow-xl border border-slate-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
            {/* Notebook Section */}
            <div className="bg-slate-50 border-r border-slate-200 flex flex-col h-full overflow-hidden">
              <div className="flex items-center px-4 py-3 bg-slate-800 text-white flex-shrink-0">
                <PencilSquareIcon className="h-5 w-5 text-blue-400 mr-2" />
                <h2 className="text-base font-semibold">Itinerary Notebook</h2>
              </div>
              <div className="flex-1 min-h-0 px-3 py-2">
                <ItineraryEditor
                  data={editorData}
                  onChange={handleEditorChange}
                  onRefreshReady={handleRefreshReady}
                  placeholder={
                    editorData
                      ? "Your itinerary is loading..."
                      : "Start planning your itinerary..."
                  }
                />
              </div>
            </div>

            {/* Map Section */}
            <div className="flex flex-col h-full bg-white">
              <div className="flex items-center px-4 py-3 bg-slate-800 text-white flex-shrink-0">
                <MapIcon className="h-5 w-5 text-green-400 mr-2" />
                <h2 className="text-base font-semibold">Interactive Map</h2>
              </div>
              <div className="flex-1 min-h-0">
                <ItineraryMap
                  editorData={editorData?.blocks}
                  directionsData={directionsData}
                  onRefreshDirections={handleRefreshDirections}
                  className="h-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
