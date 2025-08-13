"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { MapIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import dynamic from "next/dynamic";
import { useItinerary } from "@/contexts/ItineraryContext";
import { convertItineraryToEditorData } from "@/app/create-itinerary/utils/editorConverter";
import SaveStatusIndicator, {
  SaveStatus,
} from "@/components/SaveStatusIndicator";

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

// Deep comparison function for EditorData
function deepCompareEditorData(
  a: EditorData | undefined,
  b: EditorData | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  // Compare version (ignore time as it can vary)
  if (a.version !== b.version) return false;

  // Compare blocks array
  if (!a.blocks || !b.blocks) return a.blocks === b.blocks;
  if (a.blocks.length !== b.blocks.length) return false;

  // Deep compare each block
  for (let i = 0; i < a.blocks.length; i++) {
    const blockA = a.blocks[i];
    const blockB = b.blocks[i];

    if (blockA.type !== blockB.type) return false;
    if (JSON.stringify(blockA.data) !== JSON.stringify(blockB.data))
      return false;
  }

  return true;
}

export default function EditorPageContent() {
  const { state, updateEditorData, setDirectionsData } = useItinerary();
  const [localEditorData, setLocalEditorData] = useState<
    EditorData | undefined
  >();
  const editorRefreshFnRef = useRef<(() => Promise<any>) | null>(null);
  const isUpdatingFromEditor = useRef(false);

  // Save status tracking
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Update save status based on itinerary state
  useEffect(() => {
    if (state.isSaving) {
      setSaveStatus("saving");
    } else if (state.error) {
      setSaveStatus("error");
    } else if (state.lastSaved && !state.isDirty) {
      setSaveStatus("saved");
    } else if (!state.isSaving && !state.error) {
      setSaveStatus("idle");
    }
  }, [state.isSaving, state.error, state.lastSaved, state.isDirty]);

  // Load editor data from context whenever it changes (with change detection)
  useEffect(() => {
    if (state.editorData && !isUpdatingFromEditor.current) {
      // Only update if the data is actually different
      if (!deepCompareEditorData(localEditorData, state.editorData)) {
        console.log("📝 Loading itinerary from context:", state.editorData);
        setLocalEditorData(state.editorData);
      } else {
        console.log("📝 Context data unchanged, skipping update");
      }
    }

    // Reset the flag after checking
    if (isUpdatingFromEditor.current) {
      isUpdatingFromEditor.current = false;
    }
  }, [state.editorData, localEditorData]);

  // Convert currentItinerary to editorData if we have itinerary but no editorData
  useEffect(() => {
    if (state.currentItinerary && !state.editorData) {
      console.log("📝 Converting current itinerary to editor data");
      const convertedEditorData = convertItineraryToEditorData(
        state.currentItinerary
      );
      setLocalEditorData(convertedEditorData);
    }
  }, [state.currentItinerary, state.editorData]);

  // Initialize with empty itinerary if no data exists
  useEffect(() => {
    if (!state.currentItinerary && !state.editorData && !localEditorData) {
      console.log("📝 No itinerary found, starting with empty editor");
      const emptyEditorData: EditorData = {
        time: undefined,
        version: "2.8.22",
        blocks: [],
      };
      setLocalEditorData(emptyEditorData);
    }
  }, [state.currentItinerary, state.editorData, localEditorData]);

  // Log editor data changes for debugging
  useEffect(() => {
    console.log("🗺️ Editor page: Current localEditorData:", localEditorData);
    console.log(
      "🗺️ Editor page: Blocks being passed to map:",
      localEditorData?.blocks
    );
  }, [localEditorData]);

  const handleEditorChange = (data: EditorData) => {
    console.log("📝 Editor page: Editor data changed:", data);
    console.log("📝 Editor page: Editor blocks:", data.blocks);
    console.log("📝 Editor page: Number of blocks:", data.blocks?.length);

    // Set flag to prevent loading from context on next cycle
    isUpdatingFromEditor.current = true;

    // Update local state for immediate UI response
    setLocalEditorData(data);

    // Update context which will trigger database auto-save
    updateEditorData(data);
  };

  // Stable callback for when refresh function is ready
  const handleRefreshReady = useCallback((refreshFn: () => Promise<any>) => {
    console.log("🚗 Editor page: Refresh function received from editor");
    editorRefreshFnRef.current = refreshFn;
  }, []); //TODO: check if this is needed

  // Create refresh directions callback
  const handleRefreshDirections = useCallback(async () => {
    if (!editorRefreshFnRef.current) return;

    try {
      const result = await editorRefreshFnRef.current();
      const { directions, updatedPlaces } = result;

      console.log(
        `🚗 Editor page: Received ${directions.length} direction routes`
      );
      console.log(
        `🚗 Editor page: Updated ${updatedPlaces.length} places with driving times`
      );

      setDirectionsData(directions);

      // Optionally trigger editor re-render to show updated driving times
      // The place blocks should update themselves via the event system
    } catch (error) {
      console.error("🚗 Editor page: Error refreshing directions:", error);
      // TODO: Show user error notification
    }
  }, []);

  // Memoize the blocks data to prevent unnecessary map re-renders
  const memoizedBlocks = useMemo(
    () => localEditorData?.blocks,
    [localEditorData?.blocks]
  );

  console.log("EditorPage: Component rendering");
  console.log("🔍 Debug state:", {
    hasCurrentItinerary: !!state.currentItinerary,
    hasEditorData: !!state.editorData,
    hasLocalEditorData: !!localEditorData,
    editorDataBlocks: localEditorData?.blocks?.length || 0,
  });
  console.log(
    "🔍 Full localEditorData being passed to ItineraryEditor:",
    localEditorData
  );

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-2 overflow-hidden">
      {/* Main Content - Card with minimal padding, accounting for nav bar */}
      <div className="h-[calc(100vh-64px-2rem)]">
        {/* Single Horizontally Divided Card */}
        <div className="h-full bg-white shadow-xl border border-slate-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
            {/* Notebook Section */}
            <div className="bg-slate-50 border-r border-slate-200 flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-800 text-white flex-shrink-0">
                <div className="flex items-center">
                  <PencilSquareIcon className="h-5 w-5 text-blue-400 mr-2" />
                  <h2 className="text-base font-semibold">
                    Itinerary Notebook
                  </h2>
                </div>

                {/* Save Status Indicator */}
                <SaveStatusIndicator
                  status={saveStatus}
                  lastSaved={state.lastSaved}
                  error={state.error || undefined}
                  className="text-white"
                />
              </div>
              <div className="flex-1 min-h-0 px-3 py-2">
                <ItineraryEditor
                  data={localEditorData}
                  onChange={handleEditorChange}
                  onRefreshReady={handleRefreshReady}
                  placeholder={
                    localEditorData?.blocks?.length
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
                  editorData={memoizedBlocks}
                  directionsData={state.directionsData}
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
