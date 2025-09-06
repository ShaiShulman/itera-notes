import { generatePlaceDescriptionAction } from "@/actions/generatePlaceDescription";
import { useItinerary } from "@/contexts/ItineraryContext";

export interface PlaceInsertionContext {
  placeName: string;
  placeAddress?: string;
  dayNumber: number;
  editorElement: Element;
  existingLinkedParagraphId?: string;
}

export interface DayContext {
  dayNumber: number;
  dayTitle: string;
  dayDate: string;
  existingPlaces: Array<{
    name: string;
    address?: string;
  }>;
}

/**
 * Extract day context from the editor DOM
 */
export function extractDayContext(editorElement: Element, targetDayNumber: number): DayContext {
  console.log(`🔍 Extracting context for day ${targetDayNumber}...`);

  const allBlocks = editorElement.querySelectorAll(".ce-block");
  let currentDay = 0;
  let dayTitle = `Day ${targetDayNumber}`;
  let dayDate = new Date().toISOString().split('T')[0]; // Default to today
  const existingPlaces: Array<{ name: string; address?: string }> = [];
  let inTargetDay = false;

  for (let i = 0; i < allBlocks.length; i++) {
    const block = allBlocks[i];

    // Check if this is a day block
    const dayBlock = block.querySelector(".day-block");
    if (dayBlock) {
      currentDay++;
      
      if (currentDay === targetDayNumber) {
        // Extract day title and date from the day block
        const titleElement = dayBlock.querySelector("[data-day-title]") || 
                           dayBlock.querySelector("span") ||
                           dayBlock;
        if (titleElement) {
          const titleText = titleElement.textContent || "";
          // Try to extract title from format like "Day 1 - 2024-01-01 - Rome Exploration"
          const matches = titleText.match(/Day\s+\d+.*?-\s*(\d{4}-\d{2}-\d{2}).*?-\s*(.+)|Day\s+\d+.*?-\s*(.+)/);
          if (matches) {
            if (matches[1] && matches[2]) {
              dayDate = matches[1];
              dayTitle = matches[2].trim();
            } else if (matches[3]) {
              dayTitle = matches[3].trim();
            }
          }
        }
        inTargetDay = true;
        continue;
      } else if (currentDay > targetDayNumber) {
        // We've moved past the target day
        break;
      }
    }

    // If we're in the target day, collect existing places
    if (inTargetDay && currentDay === targetDayNumber) {
      const placeBlock = block.querySelector(".place-block");
      const hotelBlock = block.querySelector(".hotel-block");
      
      if (placeBlock || hotelBlock) {
        const blockElement = placeBlock || hotelBlock;
        const nameElement = blockElement?.querySelector("[data-place-name]") ||
                           blockElement?.querySelector(".place-name") ||
                           blockElement?.querySelector("span");
        
        if (nameElement && nameElement.textContent) {
          const placeName = nameElement.textContent.trim();
          if (placeName && placeName !== "Click to add...") {
            existingPlaces.push({ name: placeName });
          }
        }
      }
    }
  }

  const context = {
    dayNumber: targetDayNumber,
    dayTitle,
    dayDate,
    existingPlaces,
  };

  console.log("✅ Extracted day context:", context);
  return context;
}

/**
 * Get user preferences from context, with fallback defaults
 */
export function getUserPreferencesFromContext(itineraryState?: any) {
  // If we have form metadata from context, use it
  if (itineraryState?.formMetadata) {
    const { travelStyle, interests, destination } = itineraryState.formMetadata;
    return {
      travelStyle: travelStyle || "moderate",
      interests: interests && interests.length > 0 ? interests : ["culture", "food", "history"],
      destination: destination || "Unknown",
    };
  }

  // Fallback to defaults
  return {
    travelStyle: "moderate",
    interests: ["culture", "food", "history"],
    destination: "Unknown",
  };
}

/**
 * Try to extract destination from the page or editor context
 */
export function extractDestinationFromContext(editorElement: Element): string {
  // Try to find destination in the page title or other context
  const titleElement = document.querySelector("title");
  if (titleElement && titleElement.textContent) {
    const titleText = titleElement.textContent;
    // Look for patterns like "Rome Itinerary" or "Trip to Paris"
    const matches = titleText.match(/(?:Trip to|Visit to|Itinerary for|Travel to)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
    if (matches && matches[1]) {
      return matches[1];
    }
  }

  // Try to extract from the first day block or itinerary title
  const firstDayBlock = editorElement.querySelector(".day-block");
  if (firstDayBlock) {
    const text = firstDayBlock.textContent || "";
    const matches = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    if (matches && matches[1]) {
      return matches[1];
    }
  }

  return "Unknown Destination";
}

/**
 * Generate a paragraph description for a place and return the paragraph ID
 */
export async function generateAndInsertPlaceParagraph(
  context: PlaceInsertionContext,
  onParagraphGenerated?: (content: string, paragraphId: string) => void,
  itineraryState?: any
): Promise<{ success: boolean; paragraphId?: string; error?: string }> {
  console.log("🎯 Starting place paragraph generation:", {
    placeName: context.placeName,
    dayNumber: context.dayNumber
  });

  try {
    // Extract day context
    const dayContext = extractDayContext(context.editorElement, context.dayNumber);
    
    // Get user preferences from context
    const userPrefs = getUserPreferencesFromContext(itineraryState);

    // Extract destination - prefer from context, fallback to page extraction
    const contextDestination = userPrefs.destination !== "Unknown" ? userPrefs.destination : null;
    const destination = contextDestination || extractDestinationFromContext(context.editorElement);

    console.log("📋 Generating description with context:", {
      placeName: context.placeName,
      dayNumber: dayContext.dayNumber,
      dayTitle: dayContext.dayTitle,
      existingPlacesCount: dayContext.existingPlaces.length,
      destination,
      travelStyle: userPrefs.travelStyle,
      interests: userPrefs.interests
    });

    // Generate description via server action
    const result = await generatePlaceDescriptionAction({
      placeName: context.placeName,
      placeAddress: context.placeAddress,
      dayContext,
      travelStyle: userPrefs.travelStyle,
      interests: userPrefs.interests,
      destination,
      existingLinkedParagraphId: context.existingLinkedParagraphId,
    });

    if (!result.success || !result.content) {
      console.error("❌ Failed to generate place description:", result.error);
      return {
        success: false,
        error: result.error || "Failed to generate description",
      };
    }

    console.log("🎉 Successfully generated place description:", {
      contentLength: result.content.length,
      paragraphId: result.linkedParagraphId.slice(0, 8) + "...",
    });

    // Call the callback if provided
    if (onParagraphGenerated) {
      onParagraphGenerated(result.content, result.linkedParagraphId);
    }

    return {
      success: true,
      paragraphId: result.linkedParagraphId,
    };
  } catch (error) {
    console.error("❌ Error in generateAndInsertPlaceParagraph:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}