/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  ItineraryEditorProps,
  EditorData,
  PlaceBlockData,
} from "../types";
import {
  calculateDirections,
  extractDrivingTimes,
} from "../actions/directions";
import {
  PlaceCoordinate,
  DirectionsResponse,
} from "@/services/google/directions";
import { getDayColor } from "@/features/map/utils/colors";
import { useItinerary } from "@/contexts/ItineraryContext";

console.log("ItineraryEditor module: Loading...");

// Editor.js block interface
interface EditorBlock {
  type: string;
  data: Record<string, unknown>;
}

interface EditorBlocks {
  insert: (
    type: string,
    data?: Record<string, unknown>,
    config?: Record<string, unknown>,
    index?: number
  ) => void;
  getBlocksCount: () => number;
  getBlockByIndex: (index: number) => EditorBlock;
}

// Helper function to find insertion point after a day block
function findInsertionPointAfterDay(dayBlockElement: HTMLElement): number {
  const editorElement = dayBlockElement.closest(".codex-editor");
  if (!editorElement) {
    console.error("findInsertionPointAfterDay: Could not find editor element");
    return -1;
  }

  const allBlocks = editorElement.querySelectorAll(".ce-block");
  console.log(
    `findInsertionPointAfterDay: Found ${allBlocks.length} total blocks`
  );

  let dayBlockIndex = -1;

  // Find the index of the current day block
  for (let i = 0; i < allBlocks.length; i++) {
    if (allBlocks[i].contains(dayBlockElement)) {
      dayBlockIndex = i;
      console.log(`findInsertionPointAfterDay: Found day block at index ${i}`);
      break;
    }
  }

  if (dayBlockIndex === -1) {
    console.error("findInsertionPointAfterDay: Could not find day block index");
    return -1;
  }

  // Find the next day block (if any)
  for (let i = dayBlockIndex + 1; i < allBlocks.length; i++) {
    const block = allBlocks[i];
    if (block.querySelector(".day-block")) {
      // Found next day block, insert before it
      console.log(
        `findInsertionPointAfterDay: Found next day at index ${i}, inserting before it`
      );
      return i;
    }
  }

  // No next day found, insert at the end (after all current blocks)
  console.log(
    `findInsertionPointAfterDay: No next day found, inserting at end (index ${allBlocks.length})`
  );
  return allBlocks.length;
}

// Helper function to extract places data from editor grouped by day
async function extractPlacesDataFromEditor(editorRef: any): Promise<{
  placesByDay: { [dayIndex: number]: PlaceCoordinate[] };
  allPlaces: PlaceBlockData[];
}> {
  if (!editorRef.current) {
    return { placesByDay: {}, allPlaces: [] };
  }

  try {
    const outputData = await editorRef.current.save();
    const blocks = outputData.blocks || [];

    const placesByDay: { [dayIndex: number]: PlaceCoordinate[] } = {};
    const allPlaces: PlaceBlockData[] = [];
    let currentDayIndex = -1;

    for (const block of blocks) {
      if (block.type === "day") {
        currentDayIndex++;
        placesByDay[currentDayIndex] = [];
      } else if (block.type === "place" && currentDayIndex >= 0) {
        const placeData = block.data as PlaceBlockData;

        // Only include places with valid coordinates
        if (placeData.lat && placeData.lng && placeData.name) {
          const placeCoordinate: PlaceCoordinate = {
            lat: placeData.lat,
            lng: placeData.lng,
            uid: placeData.uid,
            name: placeData.name,
          };

          placesByDay[currentDayIndex].push(placeCoordinate);
          allPlaces.push(placeData);
        }
      }
    }

    console.log(
      `📊 Extracted ${allPlaces.length} places across ${
        Object.keys(placesByDay).length
      } days`
    );
    return { placesByDay, allPlaces };
  } catch (error) {
    console.error("Error extracting places data:", error);
    return { placesByDay: {}, allPlaces: [] };
  }
}

// Helper function to update place blocks with driving times
async function updatePlaceBlocksWithDrivingTimes(
  editorRef: any,
  drivingTimesByUid: { [uid: string]: { time: number; distance: number } }
): Promise<void> {
  if (!editorRef.current) return;

  // Dispatch custom event to update place blocks
  const event = new CustomEvent("editor:updateDrivingTimes", {
    detail: { drivingTimesByUid },
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(event);
  }
}

export default function ItineraryEditor({
  data,
  onChange,
  onRefreshReady,
  placeholder = "Start planning your itinerary...",
  readOnly = false,
}: ItineraryEditorProps) {
  console.log("ItineraryEditor component: Rendering");

  const editorRef = useRef<{
    save: () => Promise<EditorData>;
    destroy: () => void;
    blocks?: EditorBlocks;
  } | null>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setSelectedPlace } = useItinerary();

  // Refresh directions function
  const refreshDirections = useCallback(async (): Promise<{
    directions: Array<{
      dayIndex: number;
      color: string;
      directionsResult: DirectionsResponse;
    }>;
    updatedPlaces: PlaceBlockData[];
  }> => {
    console.log("🚗 ItineraryEditor: Starting directions refresh");

    try {
      // Extract places data from editor
      const { placesByDay, allPlaces } = await extractPlacesDataFromEditor(
        editorRef
      );

      if (Object.keys(placesByDay).length === 0) {
        console.log("🚗 No days with places found");
        return { directions: [], updatedPlaces: [] };
      }

      const directionsResults: Array<{
        dayIndex: number;
        color: string;
        directionsResult: DirectionsResponse;
      }> = [];
      const drivingTimesByUid: {
        [uid: string]: { time: number; distance: number };
      } = {};

      // Calculate directions for each day with at least 2 places
      for (const [dayIndexStr, places] of Object.entries(placesByDay)) {
        const dayIndex = parseInt(dayIndexStr);

        if (places.length < 2) {
          console.log(
            `🚗 Day ${dayIndex + 1}: Only ${
              places.length
            } place(s), skipping directions`
          );
          continue;
        }

        console.log(
          `🚗 Day ${dayIndex + 1}: Calculating directions for ${
            places.length
          } places`
        );

        try {
          // Call directions API for this day
          const directionsResponse: DirectionsResponse =
            await calculateDirections(places);

          // Check if this is a fallback straight-line response
          if (directionsResponse.isFallbackStraightLine) {
            console.warn(
              `⚠️ Day ${
                dayIndex + 1
              }: No driving route found, using straight-line fallback`
            );
          }

          // Extract driving times and distances
          const { times, distances } = await extractDrivingTimes(
            directionsResponse,
            places
          );

          // Store driving times by UID
          places.forEach((place, index) => {
            if (place.uid) {
              drivingTimesByUid[place.uid] = {
                time: times[index] || 0,
                distance: distances[index] || 0,
              };
            }
          });

          // Store directions result for map rendering
          directionsResults.push({
            dayIndex,
            color: getDayColor(dayIndex),
            directionsResult: directionsResponse,
          });

          const routeType = directionsResponse.isFallbackStraightLine
            ? "straight-line fallback"
            : "driving route";
          console.log(
            `✅ Day ${dayIndex + 1}: ${routeType} calculated successfully`
          );
        } catch (error) {
          console.error(
            `❌ Day ${dayIndex + 1}: Error calculating directions:`,
            error
          );
        }
      }

      // Update place blocks with driving times
      await updatePlaceBlocksWithDrivingTimes(editorRef, drivingTimesByUid);

      // Update the allPlaces array with driving times for return
      const updatedPlaces = allPlaces.map((place) => {
        if (place.uid && drivingTimesByUid[place.uid]) {
          return {
            ...place,
            drivingTimeFromPrevious: drivingTimesByUid[place.uid].time,
            drivingDistanceFromPrevious: drivingTimesByUid[place.uid].distance,
          };
        }
        return place;
      });

      const fallbackCount = directionsResults.filter(
        (r) => r.directionsResult.isFallbackStraightLine
      ).length;
      const realRoutesCount = directionsResults.length - fallbackCount;

      console.log(
        `✅ ItineraryEditor: Directions refresh completed - ${realRoutesCount} driving routes, ${fallbackCount} straight-line fallbacks`
      );

      return {
        directions: directionsResults,
        updatedPlaces,
      };
    } catch (error) {
      console.error("❌ ItineraryEditor: Error refreshing directions:", error);
      throw error;
    }
  }, []); // Empty dependency array since this function doesn't depend on props or state

  useEffect(() => {
    // Simple timeout to ensure DOM is rendered
    const timer = setTimeout(async () => {
      console.log("ItineraryEditor: Timer fired, checking for element...");

      if (!holderRef.current) {
        console.log("ItineraryEditor: Still no holder element after timeout");
        setError("Could not find editor container element");
        return;
      }

      console.log("ItineraryEditor: Element found, initializing Editor.js...");

      try {
        const { default: EditorJS } = await import("@editorjs/editorjs");
        const { default: DayBlock } = await import("./DayBlock");
        const { default: PlaceBlock } = await import("./PlaceBlock");

        console.log(
          "ItineraryEditor: Editor.js and custom blocks imported successfully"
        );

        const editor = new EditorJS({
          holder: holderRef.current,
          placeholder,
          readOnly,
          data,
          tools: {
            day: DayBlock,
            place: PlaceBlock,
          },
          onChange: async () => {
            console.log("ItineraryEditor: Content changed");
            if (onChange && editorRef.current) {
              try {
                const outputData = await editorRef.current.save();
                onChange(outputData);
              } catch (error) {
                console.error("ItineraryEditor: Error saving data:", error);
              }
            }
          },
          onReady: () => {
            console.log("ItineraryEditor: Editor ready!");
            editorRef.current = editor as unknown as {
              save: () => Promise<EditorData>;
              destroy: () => void;
              blocks?: EditorBlocks;
            };
            setIsReady(true);

            // Add event listener for day block requests to add new blocks
            const handleAddBlockRequest = (event: CustomEvent) => {
              const { dayBlockElement, blockType, dayNumber } = event.detail;
              console.log(
                `ItineraryEditor: Request to add ${blockType} after day ${dayNumber}`
              );

              if (editorRef.current?.blocks) {
                // Find the insertion point - after the last block of this day, before the next day
                const insertionIndex =
                  findInsertionPointAfterDay(dayBlockElement);
                console.log(
                  `ItineraryEditor: Calculated insertion index: ${insertionIndex}`
                );
                console.log(
                  `ItineraryEditor: Current blocks count: ${editorRef.current.blocks.getBlocksCount()}`
                );

                if (insertionIndex >= 0) {
                  // Insert the new block at the calculated position
                  editorRef.current.blocks.insert(
                    blockType,
                    {},
                    {},
                    insertionIndex
                  );
                  console.log(
                    `ItineraryEditor: Inserted ${blockType} at index ${insertionIndex}`
                  );
                } else {
                  // Fallback: insert at the end
                  console.log(
                    `ItineraryEditor: Fallback - inserting ${blockType} at end`
                  );
                  editorRef.current.blocks.insert(blockType);
                }
              }
            };

            // Add event listener for place selection events
            const handlePlaceSelectionEvent = (event: CustomEvent) => {
              const { uid, dayIndex, isSelected, placeName } = event.detail;
              console.log(
                `ItineraryEditor: Place selection event - ${placeName} (${
                  isSelected ? "selected" : "deselected"
                })`
              );

              if (isSelected) {
                setSelectedPlace({ uid, dayIndex });
              } else {
                setSelectedPlace(null);
              }
            };

            if (holderRef.current) {
              holderRef.current.addEventListener(
                "dayblock:addBlock",
                handleAddBlockRequest as EventListener
              );
              holderRef.current.addEventListener(
                "place:selectionChanged",
                handlePlaceSelectionEvent as EventListener
              );
            }
          },
        });

        console.log("ItineraryEditor: Editor instance created");
      } catch (error) {
        console.error("ItineraryEditor: Error:", error);
        setError(`Failed to initialize editor: ${String(error)}`);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (holderRef.current) {
        holderRef.current.removeEventListener("dayblock:addBlock", () => {});
        holderRef.current.removeEventListener(
          "place:selectionChanged",
          () => {}
        );
      }
      if (
        editorRef.current &&
        typeof editorRef.current.destroy === "function"
      ) {
        editorRef.current.destroy();
      }
    };
  }, [placeholder, readOnly]);

  // Expose refresh directions function to parent component
  useEffect(() => {
    if (onRefreshReady && isReady) {
      // Pass the refresh function to the parent
      onRefreshReady(refreshDirections);
    }
  }, [onRefreshReady, isReady, refreshDirections]);

  if (error) {
    return (
      <div className="itinerary-editor">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-red-800 font-bold mb-2">❌ Editor Error</h3>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const insertBlock = async (blockType: string) => {
    if (editorRef.current && editorRef.current.blocks) {
      // Insert at the end of the editor
      const totalBlocks = editorRef.current.blocks.getBlocksCount();
      console.log(
        `ItineraryEditor: Inserting ${blockType} at the end (position ${totalBlocks})`
      );

      // If adding a day block, calculate the next date
      if (blockType === "day") {
        try {
          // Use editor's save method to get current data reliably
          const outputData = await editorRef.current.save();
          const blocks = outputData.blocks || [];

          console.log(
            `ItineraryEditor: Checking ${blocks.length} saved blocks for dates`
          );

          let latestDate = "";
          const foundDates: string[] = [];

          // Find the latest date in existing day blocks
          blocks.forEach((block, index) => {
            console.log(
              `ItineraryEditor: Block ${index}:`,
              block.type,
              block.data
            );

            if (block.type === "day" && block.data?.date) {
              const blockDate = block.data.date as string;
              foundDates.push(blockDate);
              console.log(
                `ItineraryEditor: Found date in block ${index}: ${blockDate}`
              );

              if (blockDate > latestDate) {
                latestDate = blockDate;
              }
            }
          });

          console.log(
            `ItineraryEditor: Found dates: [${foundDates.join(", ")}]`
          );
          console.log(`ItineraryEditor: Latest date: ${latestDate}`);

          let nextDate = "";

          // If we found a latest date, add one day
          if (latestDate) {
            const nextDateObj = new Date(latestDate);
            nextDateObj.setDate(nextDateObj.getDate() + 1);
            nextDate = nextDateObj.toISOString().split("T")[0];
            console.log(`ItineraryEditor: Calculated next date: ${nextDate}`);
          } else {
            // If no existing dates, use today's date as default
            const today = new Date();
            nextDate = today.toISOString().split("T")[0];
            console.log(
              `ItineraryEditor: No existing dates found, using today: ${nextDate}`
            );
          }

          // Insert day block with auto-calculated date
          editorRef.current.blocks.insert(blockType, { date: nextDate });
        } catch (error) {
          console.error("Error calculating next date:", error);
          // Fallback: insert without date
          editorRef.current.blocks.insert(blockType);
        }
      } else {
        // Insert other block types normally
        editorRef.current.blocks.insert(blockType);
      }
    }
  };

  return (
    <div className="itinerary-editor h-full flex flex-col relative">
      {/* Toolbar - Sticky at top */}
      {isReady && (
        <div className="sticky top-0 z-10 flex-shrink-0 mb-4 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700 mr-4">
              Add:
            </span>

            <button
              onClick={() => insertBlock("day")}
              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium"
              title="Add Day"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="18"
                  rx="2"
                  ry="2"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
                <line
                  x1="16"
                  y1="2"
                  x2="16"
                  y2="6"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <line
                  x1="8"
                  y1="2"
                  x2="8"
                  y2="6"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <line
                  x1="3"
                  y1="10"
                  x2="21"
                  y2="10"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
              Day
            </button>

            <button
              onClick={() => insertBlock("place")}
              className="inline-flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-md hover:bg-green-100 transition-colors text-sm font-medium"
              title="Add Place"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
                <circle
                  cx="12"
                  cy="10"
                  r="3"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
              </svg>
              Place
            </button>

            <button
              onClick={() => insertBlock("paragraph")}
              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 text-slate-700 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors text-sm font-medium"
              title="Add Text"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M14 9a2 2 0 0 1-2 2H6l-3-3s1.96-2 6-2h1a2 2 0 0 1 2 2v3"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
                <path d="M7 14h13" stroke="currentColor" strokeWidth="2" />
                <path d="M7 18h6" stroke="currentColor" strokeWidth="2" />
              </svg>
              Text
            </button>
          </div>
        </div>
      )}

      {/* Loading State - Sticky at top */}
      {!isReady && (
        <div className="sticky top-0 z-10 flex-shrink-0 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-blue-800 font-medium">Loading editor...</span>
          </div>
        </div>
      )}

      {/* Editor Container - Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div
          ref={holderRef}
          className="h-full border border-slate-200 rounded-lg p-4 text-black"
          style={{
            fontSize: "16px",
            lineHeight: "1.6",
            color: "#000000",
          }}
        />
      </div>

      {/* Global styles for Editor.js content */}
      <style jsx>{`
        :global(.ce-block__content),
        :global(.ce-paragraph),
        :global(.ce-paragraph[data-placeholder]:empty::before),
        :global(.cdx-block) {
          color: #000000 !important;
        }

        :global(.ce-paragraph[data-placeholder]:empty::before) {
          color: #6b7280 !important;
        }

        :global(.codex-editor) {
          height: 100% !important;
        }

        :global(.codex-editor__redactor) {
          height: 100% !important;
          overflow: visible !important;
        }
      `}</style>
    </div>
  );
}
