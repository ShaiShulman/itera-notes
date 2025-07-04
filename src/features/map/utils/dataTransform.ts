import { MapData, MapPlace, DayData } from "../types";
import { getDayColor } from "./colors";
import { DayBlockData, PlaceBlockData } from "../../editor/types";

// Editor.js block interface
interface EditorBlock {
  type: string;
  data: DayBlockData | PlaceBlockData | Record<string, unknown>;
}

/**
 * Create a stable hash of the editor data for optimization
 */
export function createEditorDataHash(blocks: EditorBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "day") {
        const dayData = block.data as DayBlockData;
        return `day:${dayData.title}:${dayData.date}`;
      } else if (block.type === "place") {
        const placeData = block.data as PlaceBlockData;
        return `place:${placeData.name}:${placeData.lat}:${placeData.lng}`;
      }
      return `${block.type}:unknown`;
    })
    .join("|");
}

/**
 * Transform Editor.js output data to MapData format
 */
export function transformEditorDataToMapData(blocks: EditorBlock[]): MapData {
  console.log(
    "🔄 transformEditorDataToMapData called with",
    blocks.length,
    "blocks"
  );

  const days: DayData[] = [];
  const places: MapPlace[] = [];
  let currentDayIndex = -1;
  let placeNumberInDay = 0; // Track place number within current day

  blocks.forEach((block) => {
    if (block.type === "day") {
      const dayData = block.data as DayBlockData;
      currentDayIndex = days.length;
      placeNumberInDay = 0; // Reset place counter for new day

      console.log(`📅 Day ${currentDayIndex + 1}:`, dayData.title);

      days.push({
        index: currentDayIndex,
        title: dayData.title || `Day ${currentDayIndex + 1}`,
        date: dayData.date,
        color: getDayColor(currentDayIndex),
      });
    } else if (block.type === "place") {
      const placeData = block.data as PlaceBlockData;

      // Only add places that have valid location data
      if (placeData.lat && placeData.lng && placeData.name) {
        placeNumberInDay++; // Increment place number within day

        const newPlace: MapPlace = {
          id: `place-${Date.now()}-${Math.random()}`,
          uid: placeData.uid,
          name: placeData.name,
          coordinates: { lat: placeData.lat, lng: placeData.lng },
          dayIndex: currentDayIndex >= 0 ? currentDayIndex : undefined,
          placeId: placeData.placeId,
          thumbnailUrl: placeData.thumbnailUrl,
          placeNumberInDay,
          color:
            currentDayIndex >= 0 ? getDayColor(currentDayIndex) : "#6B7280",
          drivingTimeFromPrevious: placeData.drivingTimeFromPrevious,
          drivingDistanceFromPrevious: placeData.drivingDistanceFromPrevious,
        };

        console.log(
          `📍 Place ${placeNumberInDay}: ${placeData.name} at ${placeData.lat}, ${placeData.lng} (day color: ${newPlace.color})`
        );
        places.push(newPlace);
      } else {
        console.log(`❌ Invalid place data for:`, placeData.name);
      }
    }
  });

  console.log(`🎯 Result: ${days.length} days, ${places.length} places`);

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
      const placeData = block.data as PlaceBlockData;

      if (placeData.lat && placeData.lng && placeData.name) {
        places.push({
          id: `place-${Date.now()}-${Math.random()}`,
          name: placeData.name,
          coordinates: { lat: placeData.lat, lng: placeData.lng },
          dayIndex: currentDayIndex >= 0 ? currentDayIndex : undefined,
          placeId: placeData.placeId,
          thumbnailUrl: placeData.thumbnailUrl,
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
