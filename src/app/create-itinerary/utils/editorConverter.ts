import {
  GeneratedItinerary,
  ItineraryDay,
  PlaceLocation,
} from "@/services/openai/itinerary";
import { EditorData, EditorBlockData } from "@/features/editor/types";

/**
 * Converts a GeneratedItinerary from OpenAI to Editor.js format
 * @param itinerary - The generated itinerary from OpenAI
 * @returns EditorData - The data structure expected by Editor.js
 */
export function convertItineraryToEditorData(
  itinerary: GeneratedItinerary
): EditorData {
  const blocks: EditorBlockData[] = [];

  // Add title block
  blocks.push({
    id: generateBlockId(),
    type: "header",
    data: {
      text: itinerary.title,
      level: 1,
    },
  });

  // Add destination and summary info
  blocks.push({
    id: generateBlockId(),
    type: "paragraph",
    data: {
      text: `${itinerary.totalDays}-day trip to ${itinerary.destination}`,
    },
  });

  // Convert each day to day block + place blocks
  for (const day of itinerary.days) {
    // Add day block
    const dayBlock: EditorBlockData = {
      id: generateBlockId(),
      type: "day",
      data: {
        dayNumber: day.dayNumber,
        date: day.date,
        title: day.title,
        description: day.description,
        places: day.places.map((place, index) => ({
          id: generatePlaceId(day.dayNumber, index),
          uid: `place_${day.dayNumber}_${index}`,
          name: place.name,
          lat: place.lat,
          lng: place.lng,
          // Use enriched data from Google Places API if available
          placeId: place.placeId || "",
          description: place.description || "",
          address: place.address || "",
          rating: place.rating || 0,
          photoReferences: place.photoReferences || [],
          thumbnailUrl: place.thumbnailUrl || "",
          status: place.status || "found",
          // Default values for fields not in our enriched data
          notes: "",
          drivingTimeFromPrevious: place.drivingTimeFromPrevious || 0,
          drivingDistanceFromPrevious: place.drivingDistanceFromPrevious || 0,
        })),
      },
    };

    blocks.push(dayBlock);
    if (day.description) {
      blocks.push({
        id: generateBlockId(),
        type: "paragraph",
        data: { text: day.description },
      });
    }

    // Add individual place blocks for each place in the day
    for (let i = 0; i < day.places.length; i++) {
      const place = day.places[i];
      const placeBlock: EditorBlockData = {
        id: generatePlaceId(day.dayNumber, i),
        type: "place",
        data: {
          id: generatePlaceId(day.dayNumber, i),
          uid: `place_${day.dayNumber}_${i}`,
          name: place.name,
          lat: place.lat,
          lng: place.lng,
          // Use enriched data from Google Places API if available
          placeId: place.placeId || "",
          description: place.description || ``,
          address: place.address || "",
          rating: place.rating || 0,
          photoReferences: place.photoReferences || [],
          thumbnailUrl: place.thumbnailUrl || "",
          status: place.status || "found",
          // Default values for fields not in our enriched data
          notes: "",
          drivingTimeFromPrevious: place.drivingTimeFromPrevious || 0,
          drivingDistanceFromPrevious: place.drivingDistanceFromPrevious || 0,
          // Additional metadata
          dayNumber: day.dayNumber,
          orderInDay: i,
        },
      };

      blocks.push(placeBlock);

      // Add paragraph block after each place if there's paragraph text
      if (place.paragraph && place.paragraph.trim()) {
        blocks.push({
          id: generateBlockId(),
          type: "paragraph",
          data: {
            text: place.paragraph.trim(),
          },
        });
      }
    }
  }

  return {
    time: Date.now(),
    blocks,
    version: "2.28.0",
  };
}

/**
 * Converts Editor.js data back to GeneratedItinerary format
 * @param editorData - The Editor.js data structure
 * @returns GeneratedItinerary - The itinerary format for processing
 */
export function convertEditorDataToItinerary(
  editorData: EditorData
): GeneratedItinerary {
  // Handle undefined or missing blocks
  if (!editorData || !editorData.blocks || !Array.isArray(editorData.blocks)) {
    console.warn(
      "convertEditorDataToItinerary: Invalid editorData provided",
      editorData
    );
    return {
      title: "My Itinerary",
      destination: "",
      totalDays: 0,
      days: [],
    };
  }

  const blocks = editorData.blocks;
  const days: ItineraryDay[] = [];
  let title = "My Itinerary";
  let destination = "";
  let totalDays = 0;

  // Extract title from first header block
  const headerBlock = blocks.find((block) => block.type === "header");
  if (headerBlock && (headerBlock.data as any).text) {
    title = (headerBlock.data as any).text;
  }

  // Extract destination from paragraph block
  const paragraphBlock = blocks.find((block) => block.type === "paragraph");
  if (paragraphBlock && (paragraphBlock.data as any).text) {
    const text = (paragraphBlock.data as any).text;
    const match = text.match(/(\d+)-day trip to (.+)/);
    if (match) {
      totalDays = parseInt(match[1]);
      destination = match[2];
    }
  }

  // Process day blocks
  const dayBlocks = blocks.filter((block) => block.type === "day");

  for (const dayBlock of dayBlocks) {
    if (!dayBlock || !dayBlock.data) {
      console.warn(
        "convertEditorDataToItinerary: Invalid day block found",
        dayBlock
      );
      continue;
    }

    const dayData = dayBlock.data as any;

    // Extract places from the day block's places array (handle undefined places)
    const places: PlaceLocation[] = [];
    if (dayData.places && Array.isArray(dayData.places)) {
      places.push(
        ...dayData.places.map((place: any) => ({
          name: place?.name || "Unnamed Place",
          lat: place?.lat || 0,
          lng: place?.lng || 0,
          paragraph: place?.paragraph || "", // Include the itinerary description text
        }))
      );
    } //TODO: check if paragraph still required

    const day: ItineraryDay = {
      dayNumber: dayData.dayNumber || 1,
      date: dayData.date || "",
      title: dayData.title || "",
      description: dayData.description || "",
      places,
    };

    days.push(day);
  }

  // Sort days by day number
  days.sort((a, b) => a.dayNumber - b.dayNumber);

  return {
    title,
    destination,
    totalDays: Math.max(totalDays, days.length),
    days,
  };
}

/**
 * Updates place data from Google Places API results
 * @param editorData - The current Editor.js data
 * @param placeId - The place ID to update
 * @param placeDetails - The details from Google Places API
 * @returns Updated EditorData
 */
export function updatePlaceInEditorData(
  editorData: EditorData,
  placeId: string,
  placeDetails: Partial<any>
): EditorData {
  const updatedBlocks = editorData.blocks.map((block) => {
    if (block.type === "place" && block.id === placeId) {
      return {
        ...block,
        data: {
          ...block.data,
          ...placeDetails,
          status: "found" as const,
        },
      };
    }

    // Also update in day blocks
    if (block.type === "day") {
      const updatedPlaces = (block.data as any).places.map((place: any) => {
        if (place.id === placeId) {
          return {
            ...place,
            ...placeDetails,
            status: "found" as const,
          };
        }
        return place;
      });

      return {
        ...block,
        data: {
          ...block.data,
          places: updatedPlaces,
        },
      };
    }

    return block;
  });

  return {
    ...editorData,
    blocks: updatedBlocks,
    time: Date.now(),
  };
}

/**
 * Generates a unique block ID
 */
function generateBlockId(): string {
  return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generates a consistent place ID based on day and position
 */
function generatePlaceId(dayNumber: number, placeIndex: number): string {
  return `place_day${dayNumber}_${placeIndex}`;
}

/**
 * Validates that the Editor.js data is properly structured
 * @param editorData - The data to validate
 * @returns Validation result with any errors
 */
export function validateEditorData(editorData: EditorData): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!editorData.blocks || !Array.isArray(editorData.blocks)) {
    errors.push("Editor data must have a blocks array");
  }

  if (editorData.blocks) {
    // Check for required block types
    const hasHeader = editorData.blocks.some(
      (block) => block.type === "header"
    );
    if (!hasHeader) {
      errors.push("Editor data must have at least one header block");
    }

    const dayBlocks = editorData.blocks.filter((block) => block.type === "day");
    if (dayBlocks.length === 0) {
      errors.push("Editor data must have at least one day block");
    }

    // Validate day blocks
    for (const dayBlock of dayBlocks) {
      const dayData = dayBlock.data as any;
      if (!dayData.dayNumber || !dayData.date) {
        errors.push(`Day block ${dayBlock.id} is missing required fields`);
      }
    }

    // Check for duplicate day numbers
    const dayNumbers = dayBlocks.map((block) => (block.data as any).dayNumber);
    const uniqueDayNumbers = new Set(dayNumbers);
    if (dayNumbers.length !== uniqueDayNumbers.size) {
      errors.push("Duplicate day numbers found");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
