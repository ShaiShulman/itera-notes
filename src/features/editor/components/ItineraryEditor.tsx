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
import { PlaceLocation } from "@/services/openai/itinerary";
import {
  calculateDayBounds,
  emitFitDayBounds,
} from "@/features/map/boundsManager";
import HeaderBlock from "@editorjs/header";
import ParagraphBlock from "@editorjs/paragraph";
import "./editorjs-global.css";
import { MAX_ZOOM_LEVEL } from "@/features/map/components/mapSettings";
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
      } else if (
        (block.type === "place" || block.type === "hotel") &&
        currentDayIndex >= 0
      ) {
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

// Helper function to extract places from a specific day
async function extractPlacesFromDay(
  editorRef: any,
  targetDayNumber: number
): Promise<Array<{ lat: number; lng: number; name: string }>> {
  if (!editorRef.current) {
    return [];
  }

  try {
    const outputData = await editorRef.current.save();
    const blocks = outputData.blocks || [];

    const dayPlaces: Array<{ lat: number; lng: number; name: string }> = [];
    let currentDayNumber = 0;

    for (const block of blocks) {
      if (block.type === "day") {
        currentDayNumber++;
      } else if (
        (block.type === "place" || block.type === "hotel") &&
        currentDayNumber === targetDayNumber
      ) {
        const placeData = block.data as PlaceBlockData;

        // Only include places with valid coordinates
        if (placeData.lat && placeData.lng && placeData.name) {
          dayPlaces.push({
            lat: placeData.lat,
            lng: placeData.lng,
            name: placeData.name,
          });
        }
      }
    }

    console.log(
      `🗺️ Extracted ${dayPlaces.length} places from day ${targetDayNumber}:`,
      dayPlaces.map((p) => p.name)
    );
    return dayPlaces;
  } catch (error) {
    console.error("Error extracting places from day:", error);
    return [];
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
  const { setSelectedPlace, state, updateDay, setEditorData } = useItinerary();
  const { selectedPlace } = state;
  const syncInProgressRef = useRef(false);

  // Function to sync editor deletions back to context
  const syncEditorDeletionsToContext = useCallback(
    async (editorData: EditorData) => {
      if (!state.currentItinerary) return;

      try {
        const blocks = editorData.blocks || [];

        // Extract places from editor grouped by day
        const editorPlacesByDay: { [dayNumber: number]: PlaceLocation[] } = {};
        let currentDay = 0;

        blocks.forEach((block) => {
          if (block.type === "day") {
            currentDay = (block.data as any).dayNumber || currentDay + 1;
            if (!editorPlacesByDay[currentDay]) {
              editorPlacesByDay[currentDay] = [];
            }
          } else if (
            (block.type === "place" || block.type === "hotel") &&
            currentDay > 0
          ) {
            const blockData = block.data as any;
            if (blockData.name && blockData.lat && blockData.lng) {
              editorPlacesByDay[currentDay].push({
                name: blockData.name,
                lat: blockData.lat,
                lng: blockData.lng,
                placeId: blockData.placeId,
                address: blockData.address,
                rating: blockData.rating,
                photoReferences: blockData.photoReferences,
                description: blockData.description,
                thumbnailUrl: blockData.thumbnailUrl,
                status: blockData.status || "found",
              });
            }
          }
        });

        // Update context for each day if places have changed
        state.currentItinerary.days.forEach((day) => {
          const dayNumber = day.dayNumber;
          const editorPlaces = editorPlacesByDay[dayNumber] || [];

          // Compare places by name (simple comparison)
          const contextPlaceNames = day.places.map((p) => p.name).sort();
          const editorPlaceNames = editorPlaces.map((p) => p.name).sort();

          if (
            JSON.stringify(contextPlaceNames) !==
            JSON.stringify(editorPlaceNames)
          ) {
            console.log(
              `📝 Syncing places for day ${dayNumber}: editor has ${editorPlaces.length}, context has ${day.places.length}`
            );

            // Update the day with the current editor places
            updateDay(dayNumber, { places: editorPlaces });
          }
        });
      } catch (error) {
        console.error("Error syncing editor deletions to context:", error);
      }
    },
    [state.currentItinerary, updateDay]
  );

  // Function to trigger day-specific bounds calculation with maxZoom constraint
  const triggerDayBounds = useCallback(async (dayNumber: number) => {
    console.log(
      `🗺️ ItineraryEditor: Triggering day bounds for day ${dayNumber}`
    );

    try {
      // Extract places from the specific day
      const dayPlaces = await extractPlacesFromDay(editorRef, dayNumber);

      if (dayPlaces.length === 0) {
        console.log(
          `🗺️ No places found for day ${dayNumber}, skipping bounds update`
        );
        return;
      }

      // Calculate bounds for the day's places
      const bounds = calculateDayBounds(dayPlaces);

      if (bounds) {
        // Emit event to fit map to day bounds with maxZoom constraint
        emitFitDayBounds(bounds, MAX_ZOOM_LEVEL);
      }
    } catch (error) {
      console.error(
        `Error calculating day bounds for day ${dayNumber}:`,
        error
      );
    }
  }, []);

  // Function to find and expand a place block by uid
  const findAndExpandPlace = useCallback((uid: string) => {
    if (!holderRef.current) return;

    // Find all place and hotel blocks in the editor
    const placeBlocks = holderRef.current.querySelectorAll(
      ".place-block, .hotel-block"
    );

    // First, collapse all place and hotel blocks
    placeBlocks.forEach((block) => {
      const blockElement = block as HTMLElement;
      // Try to find the PlaceBlock/HotelBlock instance and collapse it
      // We'll emit a custom event to handle this
      blockElement.dispatchEvent(
        new CustomEvent("place:forceCollapse", { bubbles: true })
      );
    });

    // Find the target place block by uid
    let targetBlock: HTMLElement | null = null;

    placeBlocks.forEach((block) => {
      const blockElement = block as HTMLElement;
      // Check if this block has the matching uid by looking for it in the dataset or data attribute
      const blockData =
        blockElement.dataset.uid || blockElement.getAttribute("data-uid");

      if (blockData === uid) {
        targetBlock = blockElement;
      }
    });

    if (targetBlock) {
      // Scroll to the target block
      (targetBlock as HTMLElement).scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      // Expand the target block after a short delay to ensure scrolling completes
      setTimeout(() => {
        targetBlock!.dispatchEvent(
          new CustomEvent("place:forceExpand", { bubbles: true })
        );
      }, 300);

      console.log(
        `📍 ItineraryEditor: Found and expanded place with uid: ${uid}`
      );
    } else {
      console.warn(
        `📍 ItineraryEditor: Could not find place block with uid: ${uid}`
      );
    }
  }, []);

  // Listen for place selection changes from context
  useEffect(() => {
    if (selectedPlace && selectedPlace.uid) {
      console.log(
        `📍 ItineraryEditor: Place selected from context: ${selectedPlace.uid}`
      );
      findAndExpandPlace(selectedPlace.uid);
    } else {
      console.log("📍 ItineraryEditor: No place selected, collapsing all");
      // Collapse all place and hotel blocks when no place is selected
      if (holderRef.current) {
        const placeBlocks = holderRef.current.querySelectorAll(
          ".place-block, .hotel-block"
        );
        placeBlocks.forEach((block) => {
          const blockElement = block as HTMLElement;
          blockElement.dispatchEvent(
            new CustomEvent("place:forceCollapse", { bubbles: true })
          );
        });
      }
    }
  }, [selectedPlace, findAndExpandPlace]);

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
        const { default: HotelBlock } = await import("./HotelBlock");

        console.log(
          "ItineraryEditor: Editor.js and custom blocks imported successfully"
        );

        const editor = new EditorJS({
          holder: holderRef.current,
          placeholder,
          readOnly,
          data,
          tools: {
            header: HeaderBlock,
            paragraph: ParagraphBlock,
            day: DayBlock,
            place: PlaceBlock,
            hotel: HotelBlock,
          },
          onChange: async () => {
            console.log("ItineraryEditor: Content changed");
            if (editorRef.current) {
              try {
                // Set sync flag to prevent context-to-editor updates during this operation
                syncInProgressRef.current = true;
                
                const outputData = await editorRef.current.save();
                
                // Persist to context immediately
                setEditorData({ ...outputData, time: undefined });
                
                // Call parent onChange callback if provided
                if (onChange) {
                  onChange({ ...outputData, time: undefined });
                }

                // Sync editor deletions back to context with a small delay
                // This prevents deleted places from being re-added
                setTimeout(() => {
                  syncEditorDeletionsToContext(outputData);
                  // Clear sync flag after context sync completes
                  syncInProgressRef.current = false;
                }, 100);
              } catch (error) {
                console.error("ItineraryEditor: Error saving data:", error);
                syncInProgressRef.current = false;
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
              const { dayBlockElement, blockType, dayNumber, initialData } =
                event.detail;
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
                  // Insert the new block at the calculated position with initial data
                  editorRef.current.blocks.insert(
                    blockType,
                    initialData || {},
                    {},
                    insertionIndex
                  );
                  console.log(
                    `ItineraryEditor: Inserted ${blockType} at index ${insertionIndex} with data:`,
                    initialData
                  );
                } else {
                  // Fallback: insert at the end
                  console.log(
                    `ItineraryEditor: Fallback - inserting ${blockType} at end`
                  );
                  editorRef.current.blocks.insert(blockType, initialData || {});
                }
              }
            };

            // Add event listener for place selection events
            const handlePlaceSelectionEvent = (event: CustomEvent) => {
              const { uid, dayIndex, dayNumber, isSelected, placeName } =
                event.detail;
              console.log(
                `ItineraryEditor: Place selection event - ${placeName} (${
                  isSelected ? "selected" : "deselected"
                }) on day ${dayNumber || dayIndex}`
              );

              if (isSelected) {
                setSelectedPlace({ uid, dayIndex });
                // Trigger day-specific bounds calculation when a place is selected
                triggerDayBounds(dayNumber || dayIndex || 1);
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

  // Watch for changes in itinerary context and add new places to editor
  useEffect(() => {
    if (!isReady || !state.currentItinerary) return;
    
    // Skip if we're in the middle of a sync operation to prevent loops
    if (syncInProgressRef.current) {
      console.log("📝 Skipping context-to-editor sync - sync in progress");
      return;
    }

    // Get current editor data to compare
    if (editorRef.current) {
      editorRef.current
        .save()
        .then((currentEditorData) => {
          const currentBlocks = currentEditorData.blocks || [];

          // Extract current places from editor by day
          const editorPlacesByDay: { [dayNumber: number]: string[] } = {};
          let currentDay = 0;

          currentBlocks.forEach((block) => {
            if (block.type === "day") {
              currentDay = (block.data as any).dayNumber || currentDay + 1;
              if (!editorPlacesByDay[currentDay]) {
                editorPlacesByDay[currentDay] = [];
              }
            } else if (
              (block.type === "place" || block.type === "hotel") &&
              currentDay > 0
            ) {
              const placeName = (block.data as any).name;
              if (placeName) {
                editorPlacesByDay[currentDay].push(placeName);
              }
            }
          });

          // Compare with context places and find new ones
          if (!state.currentItinerary) return;

          state.currentItinerary.days.forEach((day) => {
            const dayNumber = day.dayNumber;
            const contextPlaces = day.places.map((p) => p.name);
            const editorPlaces = editorPlacesByDay[dayNumber] || [];

            // Find places that exist in context but not in editor
            const newPlaces = contextPlaces.filter(
              (placeName) => !editorPlaces.includes(placeName)
            );

            if (newPlaces.length > 0) {
              console.log(
                `📝 Found ${newPlaces.length} new places for day ${dayNumber}:`,
                newPlaces
              );

              // Find the corresponding day block element
              const dayBlocks =
                holderRef.current?.querySelectorAll(".day-block");
              let targetDayBlock: HTMLElement | null = null;

              dayBlocks?.forEach((block) => {
                const blockElement = block as HTMLElement;
                // Check if this is the right day block
                const dayData = blockElement.textContent?.includes(
                  `Day ${dayNumber}`
                );
                if (dayData) {
                  targetDayBlock = blockElement;
                }
              });

              if (targetDayBlock) {
                // Add each new place
                newPlaces.forEach((placeName) => {
                  const place = day.places.find((p) => p.name === placeName);
                  if (place) {
                    // Generate UID for the place
                    const placeIndex = day.places.findIndex(
                      (p) => p.name === placeName
                    );
                    const uid = `place_${dayNumber}_${placeIndex}`;

                    // Create place data for editor
                    const placeData = {
                      name: place.name,
                      lat: place.lat,
                      lng: place.lng,
                      uid: uid,
                      placeId: place.placeId,
                      address: place.address,
                      rating: place.rating,
                      photoReferences: place.photoReferences,
                      description: place.description,
                      thumbnailUrl: place.thumbnailUrl,
                      status: place.status || "found",
                      isExpanded: false, // Don't expand newly added places
                    };

                    console.log(
                      `📝 Adding place to editor: ${placeName} with UID: ${uid}`
                    );

                    // Trigger the add block event
                    const event = new CustomEvent("dayblock:addBlock", {
                      detail: {
                        dayBlockElement: targetDayBlock,
                        blockType: place.type === "hotel" ? "hotel" : "place",
                        dayNumber: dayNumber,
                        initialData: placeData,
                      },
                    });

                    holderRef.current?.dispatchEvent(event);
                  }
                });
              }
            }
          });
        })
        .catch((error) => {
          console.error("Error comparing editor data with context:", error);
        });
    }
  }, [state.currentItinerary, isReady, setEditorData]);

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
              onClick={() => insertBlock("hotel")}
              className="inline-flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-md hover:bg-purple-100 transition-colors text-sm font-medium"
              title="Add Hotel"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2 12h4l2-2h2l2 2h4v5H2v-5z"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
                <path d="M12 7v5" stroke="currentColor" strokeWidth="2" />
                <path d="M8 17h8" stroke="currentColor" strokeWidth="2" />
                <path d="M3 7v10" stroke="currentColor" strokeWidth="2" />
                <path d="M21 7v10" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M4 4h16v3H4z"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
              </svg>
              Hotel
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
          className="h-full border border-slate-200 rounded-lg p-4 text-black editor-holder"
        />
      </div>
    </div>
  );
}
