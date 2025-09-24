"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  ItineraryEditorProps,
  EditorData,
  PlaceBlockData,
  BasePlaceBlockData,
} from "../types";
import StoryModeToggle, { EditorMode } from "./StoryModeToggle";
import StoryModeView from "../../story-mode/components/StoryModeView";
import {
  PlaceCoordinate,
  DirectionsResponse,
} from "@/services/google/directions";
import { useItinerary } from "@/contexts/ItineraryContext";
import { calculateDirectionsForDaysWithCrossDayConnections } from "@/features/directions/generator";
import { PlaceLocation } from "@/services/openai/itinerary";
import {
  calculateDayBounds,
  emitFitDayBounds,
  emitDirectionStyleUpdate,
} from "@/features/map/boundsManager";
import { triggerPlaceNumberingUpdate } from "./BasePlaceBlock";
import { generateAndInsertPlaceParagraph } from "../utils/placeInsertion";
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
  delete: (index?: number) => void;
  getBlocksCount: () => number;
  getBlockByIndex: (index: number) => EditorBlock;
}

// Helper function to find insertion point after a day block
function findInsertionPointAfterDay(
  dayBlockElement: HTMLElement,
  blockType: string = ""
): number {
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

  // Find the next day block to determine the boundary of current day
  let nextDayIndex = allBlocks.length; // Default to end if no next day found
  for (let i = dayBlockIndex + 1; i < allBlocks.length; i++) {
    const block = allBlocks[i];
    if (block.querySelector(".day-block")) {
      nextDayIndex = i;
      console.log(`findInsertionPointAfterDay: Found next day at index ${i}`);
      break;
    }
  }

  // If adding a place, find optimal position: after places and their paragraphs, before hotels
  if (blockType === "place") {
    let lastPlaceIndex = dayBlockIndex; // Start after the day block
    let firstHotelIndex = nextDayIndex; // Default to end of day

    // Scan blocks between current day and next day
    for (let i = dayBlockIndex + 1; i < nextDayIndex; i++) {
      const block = allBlocks[i];

      if (block.querySelector(".place-block")) {
        lastPlaceIndex = i; // Track the last place block
      } else if (
        block.querySelector(".hotel-block") &&
        firstHotelIndex === nextDayIndex
      ) {
        firstHotelIndex = i; // Track the first hotel block (only set once)
      }
    }

    // After finding the last place, look for paragraph blocks that come after it
    let lastParagraphAfterPlace = lastPlaceIndex; // Default to last place position

    // Scan from after the last place to before the first hotel for paragraph blocks
    for (let i = lastPlaceIndex + 1; i < firstHotelIndex; i++) {
      const block = allBlocks[i];

      // Check if this is a paragraph block (EditorJS paragraph blocks have .ce-paragraph class)
      if (
        block.querySelector(".ce-paragraph") ||
        block.classList.contains("ce-block")
      ) {
        // Additional check to ensure it's actually a paragraph block type
        const blockContent =
          block.querySelector("[data-tool='paragraph']") ||
          block.querySelector(".ce-paragraph");
        if (blockContent) {
          lastParagraphAfterPlace = i; // Track the last paragraph after places
        }
      }
    }

    // Insert after the last paragraph (if any) or last place, but before the first hotel
    const insertIndex = lastParagraphAfterPlace + 1;
    console.log(
      `findInsertionPointAfterDay: Inserting place at index ${insertIndex} (after last place at ${lastPlaceIndex}, after last paragraph at ${lastParagraphAfterPlace}, before first hotel at ${firstHotelIndex})`
    );
    return Math.min(insertIndex, firstHotelIndex);
  }

  // For hotels or any other block type, insert at the end of the day (current behavior)
  console.log(
    `findInsertionPointAfterDay: Inserting ${
      blockType || "block"
    } at end of day (index ${nextDayIndex})`
  );
  return nextDayIndex;
}

// Helper function to find block index by ID
function findBlockIndexById(editorData: EditorData, blockId: string): number {
  const blocks = editorData.blocks || [];
  return blocks.findIndex((block) => block.id === blockId);
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
    if (!editorRef.current || typeof editorRef.current.save !== "function") {
      console.warn("Editor not ready for save operation");
      return { placesByDay: {}, allPlaces: [] };
    }
    const outputData = await editorRef.current.save();
    const blocks = outputData.blocks || [];

    const placesByDay: { [dayIndex: number]: PlaceCoordinate[] } = {};
    const allPlaces: BasePlaceBlockData[] = [];
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

          // Add type information to the place data for cross-day direction logic
          const enhancedPlaceData = {
            ...placeData,
            __type: block.type as "place" | "hotel",
          };

          // Add to directions data only if not hidden
          if (!placeData.hideInMap) {
            placesByDay[currentDayIndex].push(placeCoordinate);
          }

          // Always add to allPlaces for metadata (driving times need to be calculated for all places)
          allPlaces.push(enhancedPlaceData);
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
    if (!editorRef.current || typeof editorRef.current.save !== "function") {
      console.warn("Editor not ready for save operation");
      return [];
    }
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

    return dayPlaces;
  } catch (error) {
    console.error("Error extracting places from day:", error);
    return [];
  }
}

// Helper function to scroll to and focus newly inserted blocks
function scrollToAndFocusBlock(
  holderRef: React.RefObject<HTMLDivElement | null>,
  blockType: string,
  insertionIndex: number
) {
  // Wait for DOM to update before scrolling and focusing
  setTimeout(() => {
    if (!holderRef.current) return;

    // Find all blocks in the editor
    const allBlocks = holderRef.current.querySelectorAll(".ce-block");

    if (insertionIndex >= 0 && insertionIndex < allBlocks.length) {
      const newBlock = allBlocks[insertionIndex] as HTMLElement;

      // Scroll the block into view first
      newBlock.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      // Focus appropriate element based on block type after scroll starts
      setTimeout(() => {
        focusBlockElement(newBlock, blockType);
      }, 200);
    } else {
      console.warn(
        `Could not find block at index ${insertionIndex} for ${blockType}`
      );
    }
  }, 100);
}

// Helper function to focus the appropriate element within a block
function focusBlockElement(blockElement: HTMLElement, blockType: string) {
  let focusTarget: HTMLElement | null = null;

  switch (blockType) {
    case "place":
    case "hotel":
      // Place/hotel blocks handle their own focus in editing mode
      // The input will be focused automatically when they render in editing mode
      return;

    case "paragraph":
      // Focus the contenteditable div for paragraph blocks
      focusTarget = blockElement.querySelector(
        '[contenteditable="true"]'
      ) as HTMLElement;
      break;

    case "header":
      // Focus the input field for header blocks
      focusTarget = blockElement.querySelector(
        'input[type="text"]'
      ) as HTMLElement;
      if (!focusTarget) {
        // Fallback: try contenteditable div
        focusTarget = blockElement.querySelector(
          '[contenteditable="true"]'
        ) as HTMLElement;
      }
      break;

    case "day":
      // Focus the date input for day blocks
      focusTarget = blockElement.querySelector(
        'input[type="date"]'
      ) as HTMLElement;
      if (!focusTarget) {
        // Fallback: try any input in the day block
        focusTarget = blockElement.querySelector("input") as HTMLElement;
      }
      break;

    default:
      // For unknown block types, try to find any focusable element
      focusTarget = blockElement.querySelector(
        'input, [contenteditable="true"], textarea'
      ) as HTMLElement;
      break;
  }

  if (focusTarget) {
    try {
      focusTarget.focus();

      // For contenteditable elements, place cursor at the end
      if (focusTarget.hasAttribute("contenteditable")) {
        // Place cursor at the end of contenteditable element
        const range = document.createRange();
        const selection = window.getSelection();
        if (selection) {
          range.selectNodeContents(focusTarget);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }

      console.log(`📍 Focused ${blockType} block element:`, focusTarget);
    } catch (error) {
      console.warn(`Could not focus ${blockType} block element:`, error);
    }
  } else {
    console.log(`📍 No focusable element found for ${blockType} block`);
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
  const [currentMode, setCurrentMode] = useState<EditorMode>("edit");
  const [storyModeData, setStoryModeData] = useState<EditorData | null>(null);
  const { setSelectedPlace, state, updateDay } = useItinerary();
  const { selectedPlace } = state;

  // Track place/hotel block structure for numbering updates
  const lastBlockStructure = useRef<string>("");

  // Generate structure hash for place/hotel blocks
  const generateBlockStructureHash = useCallback(
    (editorData: EditorData): string => {
      if (!editorData.blocks) return "";

      // Create a hash based on type, position, and day for place/hotel blocks
      const placeHotelBlocks = editorData.blocks
        .map((block, index) => {
          if (block.type === "place" || block.type === "hotel") {
            const data = block.data as any;
            return `${block.type}-${index}-${data.dayNumber || 0}-${
              data.name || ""
            }`;
          }
          if (block.type === "day") {
            return `${block.type}-${index}`;
          }
          return null;
        })
        .filter(Boolean);

      return placeHotelBlocks.join("|");
    },
    []
  );

  // Get current editor data for story mode
  const getCurrentEditorData =
    useCallback(async (): Promise<EditorData | null> => {
      if (!editorRef.current || typeof editorRef.current.save !== "function") {
        return data || null;
      }
      try {
        return await editorRef.current.save();
      } catch (error) {
        console.error("Error getting current editor data:", error);
        return data || null;
      }
    }, [data]);

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

  // Function to check if routes are currently visible
  const areRoutesVisible = useCallback((): boolean => {
    const routeButton = document.querySelector(
      'button[title*="Hide routes"], button[title*="Show routes"]'
    ) as HTMLButtonElement;
    return routeButton && routeButton.title.includes("Hide routes");
  }, []);

  // Function to trigger day-specific bounds calculation with maxZoom constraint
  const triggerDayBounds = useCallback(async (dayNumber: number) => {
    const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(
      `🗺️ [${timestamp}] ItineraryEditor: Triggering day bounds for day ${dayNumber}`
    );

    try {
      // Extract places from the specific day
      console.log(
        `🗺️ [${timestamp}] Extracting places for day ${dayNumber}...`
      );
      const dayPlaces = await extractPlacesFromDay(editorRef, dayNumber);
      console.log(
        `🗺️ [${timestamp}] Extracted ${dayPlaces.length} places:`,
        dayPlaces.map((p) => ({ name: p.name, lat: p.lat, lng: p.lng }))
      );

      if (dayPlaces.length === 0) {
        console.log(
          `🗺️ [${timestamp}] No places found for day ${dayNumber}, skipping bounds update`
        );
        return;
      }

      // Calculate bounds for the day's places
      console.log(`🗺️ [${timestamp}] Calculating bounds...`);
      const bounds = calculateDayBounds(dayPlaces);
      console.log(`🗺️ [${timestamp}] Calculated bounds:`, bounds);

      if (bounds) {
        // Emit event to fit map to day bounds with maxZoom constraint
        console.log(
          `🗺️ [${timestamp}] Calling emitFitDayBounds with day ${dayNumber}...`
        );
        emitFitDayBounds(bounds, MAX_ZOOM_LEVEL, dayNumber);
      } else {
        console.warn(
          `🗺️ [${timestamp}] Failed to calculate bounds for day ${dayNumber}`
        );
      }
    } catch (error) {
      console.error(
        `🗺️ [${timestamp}] Error calculating day bounds for day ${dayNumber}:`,
        error
      );
    }
  }, []);

  // Function to find and scroll to a place block by uid (without expanding)
  const findAndScrollToPlace = useCallback((uid: string) => {
    if (!holderRef.current) return;

    // Find all place and hotel blocks in the editor
    const placeBlocks = holderRef.current.querySelectorAll(
      ".place-block, .hotel-block"
    );

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

      // Briefly highlight the element with yellow background
      (targetBlock as HTMLElement).style.backgroundColor = "#fef3c7";
      (targetBlock as HTMLElement).style.transition =
        "background-color 0.3s ease";
      setTimeout(() => {
        (targetBlock as HTMLElement).style.backgroundColor = "";
      }, 1500);
    }
  }, []);

  // Listen for place selection changes from context
  useEffect(() => {
    if (selectedPlace && selectedPlace.uid) {
      console.log(
        `📍 ItineraryEditor: Place selected from context: ${selectedPlace.uid}`
      );
    }
  }, [selectedPlace]);

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

      // Use shared directions calculation logic with cross-day connections
      const { directions, drivingTimesByUid } =
        await calculateDirectionsForDaysWithCrossDayConnections(
          placesByDay,
          allPlaces
        );

      // Update place blocks with driving times (editor-specific functionality)
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

      console.log(
        `✅ ItineraryEditor: Directions refresh completed - ${directions.length} routes`
      );

      return {
        directions,
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
            if (onChange && editorRef.current) {
              try {
                if (
                  !editorRef.current ||
                  typeof editorRef.current.save !== "function"
                ) {
                  console.warn("Editor not ready for save operation");
                  return;
                }
                const outputData = await editorRef.current.save();
                onChange({ ...outputData, time: undefined });

                // Check if place/hotel block structure has changed for numbering updates
                const currentStructure = generateBlockStructureHash(outputData);
                if (currentStructure !== lastBlockStructure.current) {
                  console.log(
                    "🔢 Block structure changed - triggering numbering update"
                  );
                  lastBlockStructure.current = currentStructure;
                  setTimeout(() => {
                    triggerPlaceNumberingUpdate();
                  }, 100);
                }

                // Sync editor deletions back to context with a small delay
                // This prevents deleted places from being re-added
                setTimeout(() => {
                  syncEditorDeletionsToContext(outputData);
                }, 100);
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

            // Add event listener for paragraph insertion after place generation
            const handleParagraphInsertion = async (event: CustomEvent) => {
              const { content, afterPlaceElement } = event.detail;

              if (!editorRef.current?.blocks || !afterPlaceElement) {
                console.warn(
                  "ItineraryEditor: Missing required elements for paragraph insertion:",
                  {
                    hasEditorBlocks: !!editorRef.current?.blocks,
                    hasAfterPlaceElement: !!afterPlaceElement,
                  }
                );
                return;
              }

              try {
                // Get current editor data to find the exact block
                await editorRef.current.save();
                const allBlocks =
                  holderRef.current?.querySelectorAll(".ce-block");

                let insertionIndex = -1;

                // Find which DOM block contains our place element
                if (allBlocks) {
                  for (let i = 0; i < allBlocks.length; i++) {
                    const domBlock = allBlocks[i];
                    if (domBlock.contains(afterPlaceElement)) {
                      insertionIndex = i + 1; // Insert after this block
                      break;
                    }
                  }
                }

                if (
                  insertionIndex >= 0 &&
                  insertionIndex <= editorRef.current.blocks.getBlocksCount()
                ) {
                  console.log(
                    `ItineraryEditor: About to insert paragraph at index ${insertionIndex}`
                  );

                  // Insert paragraph block and then sync the place block's linkedParagraphId with the actual generated ID
                  console.log(
                    `ItineraryEditor: Inserting paragraph (EditorJS will generate ID)...`
                  );

                  editorRef.current.blocks.insert(
                    "paragraph",
                    {
                      text: content,
                    },
                    {},
                    insertionIndex
                  );

                  console.log(
                    `ItineraryEditor: Insert operation completed at index ${insertionIndex}:`,
                    {
                      newBlockCount: editorRef.current.blocks.getBlocksCount(),
                    }
                  );

                  // Get the actual ID generated by EditorJS and update the place block
                  setTimeout(async () => {
                    try {
                      if (editorRef.current && afterPlaceElement) {
                        const updatedData = await editorRef.current.save();
                        const insertedBlock =
                          updatedData.blocks?.[insertionIndex];

                        if (
                          insertedBlock?.id &&
                          insertedBlock.type === "paragraph"
                        ) {
                          const actualParagraphId = insertedBlock.id;
                          console.log(
                            `ItineraryEditor: Paragraph inserted with actual ID: ${actualParagraphId.slice(
                              0,
                              8
                            )}...`
                          );

                          // Debug: Log the structure to understand how to find the place block instance
                          console.log(
                            "🔍 DEBUG: Searching for place block instance:",
                            {
                              afterPlaceElement: afterPlaceElement?.className,
                              hasToolInstance:
                                !!afterPlaceElement.__tool_instance,
                              contentElement:
                                afterPlaceElement.querySelector(
                                  ".ce-block__content"
                                ),
                              contentHasInstance:
                                !!afterPlaceElement.querySelector(
                                  ".ce-block__content"
                                )?.__tool_instance,
                            }
                          );

                          // Try multiple ways to find the place block instance
                          const placeBlock =
                            afterPlaceElement.__tool_instance ||
                            afterPlaceElement.querySelector(
                              ".ce-block__content"
                            )?.__tool_instance ||
                            afterPlaceElement.querySelector(".place-block")
                              ?.__tool_instance ||
                            afterPlaceElement.querySelector(".hotel-block")
                              ?.__tool_instance;

                          console.log("🔍 DEBUG: Found place block:", {
                            found: !!placeBlock,
                            hasUpdateMethod:
                              placeBlock &&
                              typeof placeBlock.updateLinkedParagraphId ===
                                "function",
                            placeBlockType:
                              placeBlock?.constructor?.name || "unknown",
                          });

                          if (
                            placeBlock &&
                            typeof placeBlock.updateLinkedParagraphId ===
                              "function"
                          ) {
                            console.log(
                              `✅ ItineraryEditor: Calling updateLinkedParagraphId directly with ID: ${actualParagraphId.slice(
                                0,
                                8
                              )}...`
                            );
                            placeBlock.updateLinkedParagraphId(
                              actualParagraphId
                            );
                            console.log(
                              `✅ ItineraryEditor: Successfully updated place block directly`
                            );

                            // Force EditorJS to update its internal state by updating the block data directly
                            setTimeout(async () => {
                              console.log(
                                `🔄 ItineraryEditor: Starting force update process for ${placeBlock.data.name}`
                              );
                              try {
                                console.log(
                                  `🔄 ItineraryEditor: Getting current editor data...`
                                );
                                const currentData =
                                  await editorRef.current?.save();
                                console.log(
                                  `🔄 ItineraryEditor: Got ${currentData?.blocks?.length} blocks from editor`
                                );

                                if (
                                  currentData?.blocks &&
                                  editorRef.current?.blocks
                                ) {
                                  console.log(
                                    `🔄 ItineraryEditor: Searching for place block with name: "${placeBlock.data.name}"`
                                  );

                                  // Log all place/hotel blocks to see what's available
                                  const placeHotelBlocks =
                                    currentData.blocks.filter(
                                      (b) =>
                                        b.type === "place" || b.type === "hotel"
                                    );
                                  console.log(
                                    `🔄 ItineraryEditor: Found ${placeHotelBlocks.length} place/hotel blocks:`,
                                    placeHotelBlocks.map((b) => ({
                                      type: b.type,
                                      name: (b.data as any).name,
                                      linkedParagraphId:
                                        (b.data as any).linkedParagraphId ||
                                        "NONE",
                                    }))
                                  );

                                  // Find the place block index
                                  let placeBlockIndex = -1;
                                  for (
                                    let i = 0;
                                    i < currentData.blocks.length;
                                    i++
                                  ) {
                                    const block = currentData.blocks[i];
                                    if (
                                      (block.type === "place" ||
                                        block.type === "hotel") &&
                                      (block.data as any).name ===
                                        placeBlock.data.name
                                    ) {
                                      placeBlockIndex = i;
                                      console.log(
                                        `🔄 ItineraryEditor: Found matching block at index ${i}`
                                      );
                                      break;
                                    }
                                  }

                                  if (placeBlockIndex >= 0) {
                                    console.log(
                                      `🔄 ItineraryEditor: Force updating EditorJS block ${placeBlockIndex} data`
                                    );

                                    // Create updated data object
                                    const currentBlockData = currentData.blocks[
                                      placeBlockIndex
                                    ].data as any;
                                    const updatedBlockData = {
                                      ...currentBlockData,
                                      linkedParagraphId: actualParagraphId,
                                    };

                                    console.log(
                                      `🔄 ItineraryEditor: Current block data linkedParagraphId: ${
                                        currentBlockData.linkedParagraphId ||
                                        "NONE"
                                      }`
                                    );
                                    console.log(
                                      `🔄 ItineraryEditor: Updated block data linkedParagraphId: ${updatedBlockData.linkedParagraphId}`
                                    );

                                    // Force update via EditorJS API
                                    console.log(
                                      `🔄 ItineraryEditor: Calling blocks.update(${placeBlockIndex}, updatedData)...`
                                    );
                                    // await editorRef.current.blocks.update(placeBlockIndex, updatedBlockData);
                                    console.log(
                                      `✅ ItineraryEditor: Force updated EditorJS block data successfully`
                                    );

                                    // Verify the update worked
                                    setTimeout(async () => {
                                      try {
                                        const verifyData =
                                          await editorRef.current?.save();
                                        const verifyBlock =
                                          verifyData?.blocks?.[placeBlockIndex];
                                        if (verifyBlock) {
                                          console.log(
                                            `🔍 ItineraryEditor: Verification - block now has linkedParagraphId: ${
                                              (verifyBlock.data as any)
                                                .linkedParagraphId || "NONE"
                                            }`
                                          );
                                        }
                                      } catch (err) {
                                        console.error(
                                          `❌ ItineraryEditor: Verification error:`,
                                          err
                                        );
                                      }
                                    }, 50);
                                  } else {
                                    console.warn(
                                      `⚠️ ItineraryEditor: Could not find place block in editor data for "${placeBlock.data.name}"`
                                    );
                                    console.warn(
                                      `⚠️ ItineraryEditor: Available place/hotel names:`,
                                      placeHotelBlocks.map(
                                        (b) => (b.data as any).name
                                      )
                                    );
                                  }
                                } else {
                                  console.error(
                                    `❌ ItineraryEditor: No editor data or blocks available`
                                  );
                                }
                              } catch (error) {
                                console.error(
                                  `❌ ItineraryEditor: Error force updating EditorJS data:`,
                                  error
                                );
                              }
                            }, 100);
                          } else {
                            console.log(
                              "⚠️ ItineraryEditor: Could not find place block instance, using fallback event system"
                            );
                            // Fallback: find the actual place block element and send event to it
                            const placeBlockElement =
                              afterPlaceElement.querySelector(".place-block") ||
                              afterPlaceElement.querySelector(".hotel-block");

                            if (placeBlockElement) {
                              const placeName =
                                placeBlockElement.querySelector(
                                  "[data-place-name]"
                                )?.textContent ||
                                placeBlockElement.querySelector(".place-name")
                                  ?.textContent ||
                                placeBlockElement.querySelector("span")
                                  ?.textContent;

                              console.log(
                                `🔄 ItineraryEditor: Found place block element for ${placeName}, sending event...`
                              );

                              const updateEvent = new CustomEvent(
                                "place:updateLinkedParagraphId",
                                {
                                  detail: {
                                    placeName: placeName,
                                    linkedParagraphId: actualParagraphId,
                                  },
                                  bubbles: true,
                                }
                              );

                              // Send to the place block element directly
                              placeBlockElement.dispatchEvent(updateEvent);
                              console.log(
                                `✅ ItineraryEditor: Sent event to place block element for ${placeName} with ID: ${actualParagraphId.slice(
                                  0,
                                  8
                                )}...`
                              );
                            } else {
                              console.warn(
                                `⚠️ ItineraryEditor: Could not find place block element in DOM`
                              );
                            }
                          }

                          // Test deletion to make sure it works
                          console.log(
                            `🧪 Testing: Can find paragraph for deletion - ${
                              findBlockIndexById(
                                updatedData,
                                actualParagraphId
                              ) >= 0
                                ? "YES"
                                : "NO"
                            }`
                          );

                          // Additional debugging: Let's verify that the place data was actually updated
                          setTimeout(async () => {
                            try {
                              const finalData = await editorRef.current?.save();

                              console.log(
                                `🔍 VERIFICATION: All blocks in editor:`,
                                finalData?.blocks?.map((b) => ({
                                  type: b.type,
                                  name: (b.data as any)?.name || "NO NAME",
                                  linkedParagraphId:
                                    (b.data as any)?.linkedParagraphId?.slice(
                                      0,
                                      8
                                    ) || "NONE",
                                }))
                              );

                              console.log(
                                `🔍 VERIFICATION: Looking for place with name:`,
                                placeBlock?.data?.name || "UNKNOWN"
                              );

                              const placeBlockData = finalData?.blocks?.find(
                                (b) =>
                                  (b.type === "place" || b.type === "hotel") &&
                                  (b.data as any).name ===
                                    (placeBlock?.data?.name || "UNKNOWN")
                              );

                              console.log(
                                `🔍 VERIFICATION: Found place block:`,
                                placeBlockData
                                  ? {
                                      type: placeBlockData.type,
                                      name: (placeBlockData.data as any)?.name,
                                      linkedParagraphId: (
                                        placeBlockData.data as any
                                      )?.linkedParagraphId,
                                      fullData: placeBlockData.data,
                                    }
                                  : "NOT FOUND"
                              );

                              console.log(
                                `🔍 VERIFICATION: Place block data after update:`,
                                {
                                  placeName:
                                    (placeBlockData?.data as any)?.name ||
                                    "NOT FOUND",
                                  storedLinkedParagraphId:
                                    (placeBlockData?.data as any)
                                      ?.linkedParagraphId || "NONE",
                                  expectedParagraphId:
                                    actualParagraphId.slice(0, 8) + "...",
                                  match:
                                    (placeBlockData?.data as any)
                                      ?.linkedParagraphId === actualParagraphId,
                                }
                              );
                            } catch (err) {
                              console.error("🔍 VERIFICATION ERROR:", err);
                            }
                          }, 500);
                        }
                      }
                    } catch (err) {
                      console.error(
                        "ItineraryEditor: Error syncing paragraph ID:",
                        err
                      );
                    }
                  }, 200);
                } else {
                  console.warn(
                    "ItineraryEditor: Invalid insertion index or could not find place block:",
                    {
                      insertionIndex,
                      totalBlocks: editorRef.current.blocks.getBlocksCount(),
                      afterPlaceElement: afterPlaceElement?.className,
                    }
                  );
                }
              } catch (error) {
                console.error(
                  "ItineraryEditor: Error in paragraph insertion:",
                  error
                );
              }
            };

            // Add event listener for day block requests to add new blocks
            const handleAddBlockRequest = (event: CustomEvent) => {
              const { dayBlockElement, blockType, dayNumber, initialData } =
                event.detail;
              console.log(
                `ItineraryEditor: Request to add ${blockType} after day ${dayNumber}`
              );

              if (editorRef.current?.blocks) {
                // Find the insertion point - considering block type for optimal positioning
                const insertionIndex = findInsertionPointAfterDay(
                  dayBlockElement,
                  blockType
                );
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

                  // Scroll to and focus the newly inserted block
                  scrollToAndFocusBlock(holderRef, blockType, insertionIndex);
                } else {
                  // Fallback: insert at the end
                  console.log(
                    `ItineraryEditor: Fallback - inserting ${blockType} at end`
                  );
                  const totalBlocks = editorRef.current.blocks.getBlocksCount();
                  editorRef.current.blocks.insert(blockType, initialData || {});

                  // Scroll to and focus the newly inserted block at the end
                  scrollToAndFocusBlock(holderRef, blockType, totalBlocks);
                }

                // Trigger place numbering update after any place or hotel block is added
                if (blockType === "place" || blockType === "hotel") {
                  setTimeout(() => {
                    triggerPlaceNumberingUpdate();
                  }, 50); // Small delay to ensure DOM is updated
                }

                // Note: Paragraph generation for map-added places is now handled
                // by the unified system in the map selection handler below
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
                // Note: Removed triggerDayBounds() call - map bounds should only change on hover, not on expand
              } else {
                setSelectedPlace(null);
              }
            };

            // Add event listener for block deletion requests
            const handleDeleteBlockRequest = async (event: CustomEvent) => {
              const { blockElement, blockType, blockName, linkedParagraphId } =
                event.detail;
              console.log(
                `🗑️ DELETE REQUEST: ${blockType} "${blockName}"${
                  linkedParagraphId
                    ? ` (linked: ${linkedParagraphId.slice(0, 8)})`
                    : " (no link)"
                }`
              );
              console.log(
                "🗑️ DELETE EVENT DETAIL:",
                JSON.stringify(event.detail, null, 2)
              );

              if (editorRef.current?.blocks && blockElement) {
                // Find the block index by comparing DOM elements
                const allBlocks =
                  holderRef.current?.querySelectorAll(".ce-block");
                if (allBlocks) {
                  let blockIndex = -1;
                  for (let i = 0; i < allBlocks.length; i++) {
                    if (allBlocks[i] === blockElement) {
                      blockIndex = i;
                      break;
                    }
                  }

                  if (blockIndex >= 0) {
                    console.log(
                      `ItineraryEditor: Deleting block at index ${blockIndex} (${blockType}: ${blockName})`
                    );

                    // If there's a linked paragraph, delete it first
                    if (linkedParagraphId) {
                      try {
                        const outputData = await editorRef.current.save();
                        console.log(
                          `🔍 SEARCHING for paragraph ID: ${linkedParagraphId.slice(
                            0,
                            8
                          )} among ${outputData.blocks.length} blocks`
                        );
                        console.log(
                          `🔍 PARAGRAPH BLOCKS:`,
                          outputData.blocks
                            .filter((b) => b.type === "paragraph")
                            .map((b) => ({
                              type: b.type,
                              id: b.id!.slice(0, 8),
                              text: (b.data as any).text?.slice(0, 50),
                            }))
                        );
                        const paragraphIndex = findBlockIndexById(
                          outputData,
                          linkedParagraphId
                        );

                        if (paragraphIndex >= 0) {
                          console.log(
                            `🗑️ DELETING LINKED PARAGRAPH at index ${paragraphIndex} with ID ${linkedParagraphId.slice(
                              0,
                              8
                            )}`
                          );
                          editorRef.current.blocks.delete(paragraphIndex);

                          // Adjust the place block index if paragraph was before it
                          if (paragraphIndex < blockIndex) {
                            blockIndex--;
                            console.log(
                              `ItineraryEditor: Adjusted place block index to ${blockIndex} after paragraph deletion`
                            );
                          }
                        } else {
                          console.warn(
                            `ItineraryEditor: Could not find linked paragraph with ID: ${linkedParagraphId.slice(
                              0,
                              8
                            )}`
                          );
                          console.warn(
                            `Available IDs:`,
                            outputData.blocks.map((b) => ({
                              type: b.type,
                              id: b.id!.slice(0, 8),
                            }))
                          );
                        }
                      } catch (error) {
                        console.warn(
                          "ItineraryEditor: Could not delete linked paragraph:",
                          error
                        );
                      }
                    }

                    // Use Editor.js blocks.delete() API to properly remove the place block
                    editorRef.current.blocks.delete(blockIndex);

                    // Trigger place numbering update after deletion
                    setTimeout(() => {
                      triggerPlaceNumberingUpdate();
                    }, 50);

                    console.log(
                      `ItineraryEditor: Successfully deleted ${blockType} block${
                        linkedParagraphId ? " and its linked paragraph" : ""
                      }`
                    );
                  } else {
                    console.warn(
                      `ItineraryEditor: Could not find block index for deletion: ${blockType}`
                    );
                  }
                }
              }
            };

            // Add story mode event listeners for map integration
            const handleStoryDayHover = (event: CustomEvent) => {
              const { dayNumber, places } = event.detail;
              console.log("📡 story:dayHover received:", {
                dayNumber,
                placeCount: places.length,
              });

              // Fit map bounds to day places with max zoom constraint
              if (places.length > 0) {
                const dayPlaceCoords = places
                  .filter((place: BasePlaceBlockData) => place.lat && place.lng)
                  .map((place: BasePlaceBlockData) => ({
                    lat: place.lat!,
                    lng: place.lng!,
                    name: place.name || "Unnamed Place",
                  }));

                if (dayPlaceCoords.length > 0) {
                  const bounds = calculateDayBounds(dayPlaceCoords);
                  if (bounds) {
                    emitFitDayBounds(bounds, MAX_ZOOM_LEVEL);
                  }
                }
              }

              // Only update direction styles if routes are currently visible
              if (areRoutesVisible()) {
                // Highlight this day's directions (thick lines) and dim others (thin lines)
                emitDirectionStyleUpdate(dayNumber - 1); // Convert to 0-based dayIndex
              }
            };

            const handleStoryPlaceHover = (event: CustomEvent) => {
              const { place, dayNumber } = event.detail;
              console.log("📡 story:placeHover received:", {
                placeName: place.name,
                dayNumber,
              });

              // Set selected place on map
              if (place.uid) {
                setSelectedPlace({
                  uid: place.uid,
                  dayIndex: (dayNumber || 1) - 1,
                });
              }

              // Only update direction styles if routes are currently visible
              if (areRoutesVisible() && dayNumber) {
                // Highlight this day's directions (thick lines) and dim others (thin lines)
                emitDirectionStyleUpdate(dayNumber - 1); // Convert to 0-based dayIndex
              }
            };

            const handleStoryHoverEnd = () => {
              console.log("📡 story:hoverEnd received");

              // Clear selected place
              setSelectedPlace(null);

              // Note: Do NOT reset direction styles on story mode hover-out - maintain current day highlighting
              // Direction styles should only be reset when explicitly needed, not on every hover-out
            };

            // Add event listener for map place clicks
            const handleMapPlaceClick = (event: CustomEvent) => {
              const { uid } = event.detail;

              // Scroll to the corresponding place block in the editor (but don't expand it)
              if (uid) {
                findAndScrollToPlace(uid);
              }
            };

            // Add event listener for editor hover events
            const handleEditorPlaceHover = (event: CustomEvent) => {
              const { place, dayNumber } = event.detail;
              console.log("📡 editor:placeHover received:", {
                placeName: place.name,
                uid: place.uid,
                dayNumber,
                timestamp: new Date().toISOString().split("T")[1].split(".")[0],
              });

              // Set selected place on map
              if (place.uid) {
                console.log("📡 editor:placeHover: Setting selected place:", {
                  uid: place.uid,
                  dayIndex: (dayNumber || 1) - 1,
                });
                setSelectedPlace({
                  uid: place.uid,
                  dayIndex: (dayNumber || 1) - 1,
                });
              }

              // Trigger day-specific bounds calculation
              console.log(
                "📡 editor:placeHover: Calling triggerDayBounds for day:",
                dayNumber || 1
              );
              triggerDayBounds(dayNumber || 1);

              // Only update direction styles if routes are currently visible
              if (areRoutesVisible() && dayNumber) {
                const dayIndex = dayNumber - 1;
                console.log("📡 editor:placeHover: Direction styling update:", {
                  placeName: place.name,
                  placeUID: place.uid,
                  extractedDayNumber: dayNumber,
                  calculatedDayIndex: dayIndex,
                  shouldHighlightDay: dayNumber,
                });
                emitDirectionStyleUpdate(dayIndex); // Convert to 0-based dayIndex
              }
            };

            const handleEditorDayHover = async (event: CustomEvent) => {
              const { dayNumber, places } = event.detail;
              console.log("📡 editor:dayHover received from DOM:", {
                dayNumber,
                placeCount: places.length,
                domPlaces: places.map((p: any) => ({
                  uid: p.uid,
                  name: p.name,
                  lat: p.lat,
                  lng: p.lng,
                  hasCoords: !!(p.lat && p.lng),
                })),
              });

              // Use the same extraction method as place hover for consistency
              console.log(
                "📡 editor:dayHover: Using extractPlacesFromDay for consistency..."
              );
              const editorPlaces = await extractPlacesFromDay(
                editorRef,
                dayNumber
              );

              console.log("📡 editor:dayHover extracted from editor:", {
                editorPlaceCount: editorPlaces.length,
                editorPlaces: editorPlaces.map((p) => ({
                  name: p.name,
                  lat: p.lat,
                  lng: p.lng,
                })),
              });

              // Use editor places (more reliable than DOM scan)
              if (editorPlaces.length > 0) {
                const bounds = calculateDayBounds(editorPlaces);
                console.log("📡 editor:dayHover calculated bounds:", bounds);
                if (bounds) {
                  console.log("📡 editor:dayHover emitting fitDayBounds...");
                  emitFitDayBounds(bounds, MAX_ZOOM_LEVEL, dayNumber);
                }
              } else {
                console.warn(
                  "📡 editor:dayHover: No places found in editor data for day",
                  dayNumber
                );
              }

              // Only update direction styles if routes are currently visible
              if (areRoutesVisible()) {
                // Highlight this day's directions (thick lines) and dim others (thin lines)
                emitDirectionStyleUpdate(dayNumber - 1); // Convert to 0-based dayIndex
              }
            };

            const handleEditorHoverEnd = () => {
              console.log("📡 editor:hoverEnd received");

              // Clear selected place
              setSelectedPlace(null);

              // Note: Do NOT reset direction styles on hover-out - maintain current day highlighting
              // Direction styles should only be reset when explicitly needed, not on every hover-out
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
              holderRef.current.addEventListener(
                "block:requestDelete",
                handleDeleteBlockRequest as any
              );
              holderRef.current.addEventListener(
                "place:insertParagraph",
                handleParagraphInsertion as any
              );
            }

            // Add story mode event listeners to window
            if (typeof window !== "undefined") {
              window.addEventListener(
                "story:dayHover",
                handleStoryDayHover as EventListener
              );
              window.addEventListener(
                "story:placeHover",
                handleStoryPlaceHover as EventListener
              );
              window.addEventListener(
                "story:hoverEnd",
                handleStoryHoverEnd as EventListener
              );

              // Add editor-specific event listeners
              window.addEventListener(
                "map:placeClicked",
                handleMapPlaceClick as EventListener
              );
              window.addEventListener(
                "editor:dayHover",
                handleEditorDayHover as unknown as EventListener
              );
              window.addEventListener(
                "editor:placeHover",
                handleEditorPlaceHover as EventListener
              );
              window.addEventListener(
                "editor:hoverEnd",
                handleEditorHoverEnd as EventListener
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
        holderRef.current.removeEventListener(
          "place:insertParagraph",
          () => {}
        );
      }

      // Remove story mode event listeners from window
      if (typeof window !== "undefined") {
        window.removeEventListener("story:dayHover", () => {});
        window.removeEventListener("story:placeHover", () => {});
        window.removeEventListener("story:hoverEnd", () => {});

        // Remove editor-specific event listeners
        window.removeEventListener("map:placeClicked", () => {});
        window.removeEventListener("editor:dayHover", () => {});
        window.removeEventListener("editor:placeHover", () => {});
        window.removeEventListener("editor:hoverEnd", () => {});
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

                    // Create minimal place data - let the block discover the full details
                    const placeData = {
                      name: place.name,
                      uid: uid,
                      // Don't include placeId, address, etc. - let the block find these through autocomplete flow
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

                    console.log(
                      `📝 Map-added place will discover its details through normal autocomplete flow and generate its own paragraph`
                    );
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
  }, [state.currentItinerary, isReady]);

  // Expose refresh directions function to parent component
  useEffect(() => {
    if (onRefreshReady && isReady) {
      // Pass the refresh function to the parent
      onRefreshReady(refreshDirections);
    }
  }, [onRefreshReady, isReady, refreshDirections]);

  // Update story mode data when switching to story mode
  useEffect(() => {
    if (currentMode === "story") {
      getCurrentEditorData().then(setStoryModeData);
    }
  }, [currentMode, getCurrentEditorData]);

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
          if (
            !editorRef.current ||
            typeof editorRef.current.save !== "function"
          ) {
            console.warn(
              "Editor not ready for save operation, skipping date calculation"
            );
            return;
          }
          if (
            !editorRef.current ||
            typeof editorRef.current.save !== "function"
          ) {
            console.warn("Editor not ready for save operation");
            return;
          }
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

      // Scroll to and focus the newly inserted block at the end
      scrollToAndFocusBlock(holderRef, blockType, totalBlocks);

      // Trigger place numbering update after any place or hotel block is added
      if (blockType === "place" || blockType === "hotel") {
        setTimeout(() => {
          triggerPlaceNumberingUpdate();
        }, 50); // Small delay to ensure DOM is updated
      }
    }
  };

  return (
    <div className="itinerary-editor h-full flex flex-col relative">
      {/* Mode Toggle - Always visible */}
      <StoryModeToggle
        currentMode={currentMode}
        onModeChange={setCurrentMode}
        disabled={!isReady}
      />

      {/* Loading State - Sticky at top */}
      {!isReady && (
        <div className="sticky top-0 z-10 flex-shrink-0 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-blue-800 font-medium">Loading editor...</span>
          </div>
        </div>
      )}

      {/* Content Area - Conditional rendering based on mode */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Edit Mode - Editor Container - Always render but conditionally hide */}
        <div
          ref={holderRef}
          className={`h-full border border-slate-200 rounded-lg p-4 text-black editor-holder ${
            currentMode === "edit" ? "block" : "hidden"
          }`}
        />

        {/* Story Mode - Story View - Only render when in story mode */}
        {currentMode === "story" && (
          <div className="h-full border border-slate-200 rounded-lg p-4 bg-white">
            {storyModeData ? (
              <StoryModeView editorData={storyModeData} />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                  <p>Loading story view...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
