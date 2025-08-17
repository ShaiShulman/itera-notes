import { MapData, MapPlace, DayData } from "../types";
import { getDayColor } from "./colors";
import { BasePlaceBlockData, DayBlockData } from "../../editor/types";

// Module-level variable to track previous transform hash
let previousTransformHash = "";

// Editor.js block interface
interface EditorBlock {
  type: string;
  data: DayBlockData | BasePlaceBlockData | Record<string, unknown>;
}

/**
 * Create a stable hash of the editor data for optimization
 * Only includes data that affects map rendering (excludes selection state, expansion state, etc.)
 */
export function createEditorDataHash(blocks: EditorBlock[]): string {
  if (!blocks || blocks.length === 0) {
    return "empty";
  }

  return blocks
    .map((block) => {
      if (block.type === "day") {
        const dayData = block.data as DayBlockData;
        return `day:${dayData.title}:${dayData.date}`;
      } else if (block.type === "place" || block.type === "hotel") {
        const placeData = block.data as BasePlaceBlockData;
        // Include all essential data that affects map display (excluding UI state like isExpanded)
        const lat = placeData.lat || "null";
        const lng = placeData.lng || "null";
        const name = placeData.name || "unnamed";
        const uid = placeData.uid || "no-uid";
        const hideInMap = placeData.hideInMap ? "hidden" : "visible";
        return `${block.type}:${name}:${lat}:${lng}:${uid}:${hideInMap}`;
      }
      return `${block.type}:unknown`;
    })
    .join("|");
}

/**
 * Transform Editor.js output data to MapData format
 */
export function transformEditorDataToMapData(blocks: EditorBlock[]): MapData {
  const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
  console.log(
    `🔄 [${timestamp}] transformEditorDataToMapData called with`,
    blocks.length,
    "blocks"
  );

  // Create detailed hash for tracking changes
  const currentHash = createEditorDataHash(blocks);
  console.log(`🔍 [${timestamp}] Current data hash:`, currentHash);

  // Store previous hash for comparison (using a module-level variable)
  if (!previousTransformHash) {
    previousTransformHash = "";
  }

  if (previousTransformHash !== currentHash) {
    previousTransformHash = currentHash;
  }

  const days: DayData[] = [];
  const places: MapPlace[] = [];
  let currentDayIndex = -1;
  let placeNumberInDay = 0; // Track place number within current day (for places only)
  let hotelNumberInDay = 0; // Track hotel number within current day (for hotels only)

  blocks.forEach((block) => {
    if (block.type === "day") {
      const dayData = block.data as DayBlockData;
      currentDayIndex++;
      placeNumberInDay = 0; // Reset place counter for new day
      hotelNumberInDay = 0; // Reset hotel counter for new day

      days.push({
        index: currentDayIndex,
        title: dayData.title || `Day ${currentDayIndex + 1}`,
        date: dayData.date,
        color: getDayColor(currentDayIndex),
      });
    } else if (block.type === "place" || block.type === "hotel") {
      const placeData = block.data as BasePlaceBlockData;
      
      // Always increment counters to maintain correct numbering (regardless of visibility)
      let itemNumberInDay: number;
      if (block.type === "place") {
        placeNumberInDay++;
        itemNumberInDay = placeNumberInDay;
      } else {
        hotelNumberInDay++;
        itemNumberInDay = hotelNumberInDay;
      }
      
      // Only add places that have valid location data and are not hidden from map
      if (placeData.lat && placeData.lng && placeData.name && !placeData.hideInMap) {

        const newPlace: MapPlace = {
          id: crypto.randomUUID(),
          uid: placeData.uid,
          name: placeData.name,
          coordinates: { lat: placeData.lat, lng: placeData.lng },
          dayIndex: currentDayIndex >= 0 ? currentDayIndex : undefined,
          placeId: placeData.placeId,
          thumbnailUrl: placeData.thumbnailUrl,
          placeNumberInDay: itemNumberInDay,
          color:
            currentDayIndex >= 0 ? getDayColor(currentDayIndex) : "#6B7280",
          drivingTimeFromPrevious: placeData.drivingTimeFromPrevious,
          drivingDistanceFromPrevious: placeData.drivingDistanceFromPrevious,
          type: block.type === "place" ? "place" : "hotel",
          hideInMap: placeData.hideInMap,
        };

        console.log(
          `📍 ${
            block.type === "place" ? "Place" : "Hotel"
          } ${itemNumberInDay}: ${placeData.name} at ${placeData.lat}, ${
            placeData.lng
          } (day color: ${newPlace.color})`
        );
        places.push(newPlace);
      } else if (placeData.hideInMap) {
        console.log(`👁️ Skipping hidden ${block.type} ${itemNumberInDay}: ${placeData.name}`);
      } else {
        console.log(`❌ Invalid place data for ${block.type} ${itemNumberInDay}:`, placeData.name);
      }
    }
  });

  console.log(`🎯 [${timestamp}] Transformation complete - returning MapData`);

  return { days, places };
}

/**
 * Extract just the places from Editor.js data
 */
export function extractPlacesFromEditorData(blocks: EditorBlock[]): MapPlace[] {
  const places: MapPlace[] = [];
  let currentDayIndex = -1;

  blocks.forEach((block) => {
    if (block.type === "day") {
      currentDayIndex++;
    } else if (block.type === "place") {
      const placeData = block.data as BasePlaceBlockData;

      if (placeData.lat && placeData.lng && placeData.name && !placeData.hideInMap) {
        places.push({
          id: crypto.randomUUID(),
          name: placeData.name,
          coordinates: { lat: placeData.lat, lng: placeData.lng },
          dayIndex: currentDayIndex >= 0 ? currentDayIndex : undefined,
          placeId: placeData.placeId,
          thumbnailUrl: placeData.thumbnailUrl,
          hideInMap: placeData.hideInMap,
        });
      }
    }
  });

  return places;
}

/**
 * Get day information from Editor.js data
 */
export function extractDaysFromEditorData(blocks: EditorBlock[]): DayData[] {
  const days: DayData[] = [];

  blocks.forEach((block) => {
    if (block.type === "day") {
      const dayData = block.data as DayBlockData;
      const dayIndex = days.length;

      days.push({
        index: dayIndex,
        title: dayData.title || `Day ${dayIndex + 1}`,
        date: dayData.date,
        color: getDayColor(dayIndex),
      });
    }
  });

  return days;
}

/**
 * Find which day a place belongs to based on its position in the editor
 */
export function findPlaceDayIndex(
  blocks: EditorBlock[],
  placeBlockIndex: number
): number {
  let currentDayIndex = -1;

  for (let i = 0; i < placeBlockIndex; i++) {
    if (blocks[i].type === "day") {
      currentDayIndex++;
    }
  }

  return currentDayIndex;
}
