import { PrismaClient } from "@prisma/client";
import { EditorData } from "@/features/editor/types";
import { DirectionsData } from "@/features/directions/types";
import { generateContentHash } from "./utils/hash";
import {
  SaveItineraryRequest,
  SaveItineraryResponse,
  LoadItineraryResponse,
  ItinerarySummary,
  ListItinerariesResponse,
  DeleteItineraryResponse,
} from "./types";

const prisma = new PrismaClient();

/**
 * Saves an itinerary and its directions in a single transaction
 * Includes conflict resolution for concurrent edits
 */
export async function saveItinerary(
  userId: string,
  request: SaveItineraryRequest
): Promise<SaveItineraryResponse> {
  console.log("💾 Saving itinerary to database:", { 
    id: request.id, 
    title: request.title,
    blocksCount: request.editorData.blocks.length,
    hasFormMetadata: !!(request.destination || request.startDate || request.endDate || request.interests || request.travelStyle)
  });

  const contentHash = generateContentHash(request.editorData);
  const editorDataJson = JSON.stringify(request.editorData);
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      let itineraryId = request.id;

      if (request.id) {
        // Try to update existing itinerary
        const existing = await tx.itinerary.findUnique({
          where: { id: request.id, userId },
          select: { hash: true },
        });

        if (existing) {
          // Itinerary exists - update it
          // Check if content has actually changed
          if (existing.hash === contentHash) {
            console.log("📊 Content unchanged, skipping save");
            return { id: request.id, success: true, unchanged: true };
          }

          // Get the full existing itinerary to check current form metadata
          const fullExisting = await tx.itinerary.findUnique({
            where: { id: request.id, userId },
            select: {
              destination: true,
              startDate: true,
              endDate: true,
              interests: true,
              travelStyle: true,
              additionalNotes: true,
            },
          });

          // Update the itinerary - ensure required fields have values
          await tx.itinerary.update({
            where: { id: request.id, userId },
            data: {
              title: request.title,
              editorData: editorDataJson,
              hash: contentHash,
              
              // Update form metadata if provided, otherwise keep existing or provide defaults
              destination: request.destination !== undefined 
                ? request.destination 
                : (fullExisting?.destination || "Unknown Destination"),
              startDate: request.startDate !== undefined 
                ? request.startDate 
                : (fullExisting?.startDate || new Date()),
              endDate: request.endDate !== undefined 
                ? request.endDate 
                : (fullExisting?.endDate || new Date()),
              interests: request.interests !== undefined 
                ? request.interests 
                : (fullExisting?.interests || []),
              travelStyle: request.travelStyle !== undefined 
                ? request.travelStyle 
                : (fullExisting?.travelStyle || "mid-range"),
              additionalNotes: request.additionalNotes !== undefined 
                ? request.additionalNotes 
                : fullExisting?.additionalNotes,
              
              updatedAt: new Date(),
            },
          });
        } else {
          // Itinerary doesn't exist - create it with the provided ID
          console.log("📝 Itinerary not found, creating new one with ID:", request.id);
          await tx.itinerary.create({
            data: {
              id: request.id, // Use the provided ID
              userId,
              title: request.title,
              editorData: editorDataJson,
              hash: contentHash,
              
              // Include form metadata (provide defaults for required fields)
              destination: request.destination || "Unknown Destination",
              startDate: request.startDate || new Date(),
              endDate: request.endDate || new Date(),
              interests: request.interests || [],
              travelStyle: request.travelStyle || "mid-range",
              additionalNotes: request.additionalNotes || null,
            },
          });
        }
      } else {
        // Create new itinerary
        const newItinerary = await tx.itinerary.create({
          data: {
            userId,
            title: request.title,
            editorData: editorDataJson,
            hash: contentHash,
            
            // Include form metadata (provide defaults for required fields)
            destination: request.destination || "Unknown Destination",
            startDate: request.startDate || new Date(),
            endDate: request.endDate || new Date(),
            interests: request.interests || [],
            travelStyle: request.travelStyle || "mid-range",
            additionalNotes: request.additionalNotes || null,
          },
        });
        itineraryId = newItinerary.id;
      }

      // Handle directions if provided
      if (request.directions && request.directions.length > 0) {
        // Delete existing directions for this itinerary
        await tx.itineraryDirections.deleteMany({
          where: { itineraryId: itineraryId! },
        });

        // Filter and validate directions data
        const validDirections = request.directions.filter((direction) => {
          // Validate that all required fields are present and valid
          if (typeof direction.dayIndex !== 'number' || direction.dayIndex < 0) {
            console.warn("Skipping direction with invalid dayIndex:", direction.dayIndex);
            return false;
          }
          if (!direction.color || typeof direction.color !== 'string') {
            console.warn("Skipping direction with invalid color:", direction.color);
            return false;
          }
          if (!direction.directionsResult) {
            console.warn("Skipping direction with no directionsResult");
            return false;
          }
          return true;
        });

        if (validDirections.length > 0) {
          // Insert new directions
          const directionsData = validDirections.map((direction) => ({
            itineraryId: itineraryId!,
            dayIndex: direction.dayIndex,
            color: direction.color,
            directionsResult: JSON.stringify(direction.directionsResult),
          }));

          console.log(`💾 Saving ${directionsData.length} valid directions (filtered from ${request.directions.length})`);
          await tx.itineraryDirections.createMany({
            data: directionsData,
          });
        } else {
          console.warn("⚠️ No valid directions to save after filtering");
        }
      }

      return { id: itineraryId!, unchanged: false };
    });

    if (result.unchanged) {
      return { id: result.id, success: true };
    }

    console.log("✅ Itinerary saved successfully:", result.id);
    return { id: result.id, success: true };

  } catch (error) {
    console.error("❌ Error saving itinerary:", error);

    // Handle potential conflicts
    if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
      console.log("🔄 Conflict detected, attempting to resolve...");
      
      // Wait a short time and retry once
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        const retryResult = await saveItinerary(userId, request);
        return { ...retryResult, conflictResolved: true };
      } catch (retryError) {
        console.error("❌ Conflict resolution failed:", retryError);
        return {
          id: request.id || "",
          success: false,
          error: "Conflict resolution failed. Please refresh and try again.",
        };
      }
    }

    return {
      id: request.id || "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Loads an itinerary and its directions by ID
 */
export async function loadItinerary(
  userId: string,
  itineraryId: string
): Promise<LoadItineraryResponse> {
  console.log("📥 Loading itinerary from database:", itineraryId);

  try {
    const itinerary = await prisma.itinerary.findUnique({
      where: { id: itineraryId, userId },
      include: {
        directions: {
          orderBy: { dayIndex: "asc" },
        },
      },
    });

    if (!itinerary) {
      return {
        success: false,
        error: "Itinerary not found",
      };
    }

    // Parse editor data with error handling
    let editorData: EditorData;
    try {
      editorData = JSON.parse(itinerary.editorData);
      
      // Validate the parsed data structure
      if (!editorData || typeof editorData !== 'object') {
        throw new Error('Invalid editorData structure');
      }
      if (!editorData.blocks || !Array.isArray(editorData.blocks)) {
        console.warn("Fixing missing blocks array in editorData");
        editorData.blocks = [];
      }
    } catch (parseError) {
      console.error("Error parsing editorData JSON:", parseError);
      // Return a default structure if parsing fails
      editorData = {
        time: Date.now(),
        blocks: [],
        version: "2.28.0"
      };
    }

    // Parse directions with error handling
    const directions: DirectionsData[] = [];
    for (const dir of itinerary.directions) {
      try {
        directions.push({
          dayIndex: dir.dayIndex,
          color: dir.color,
          directionsResult: JSON.parse(dir.directionsResult),
        });
      } catch (parseError) {
        console.error("Error parsing direction JSON:", parseError, dir);
        // Skip this direction if it can't be parsed
      }
    }

    console.log("✅ Itinerary loaded successfully:", {
      id: itinerary.id,
      title: itinerary.title,
      blocksCount: editorData.blocks.length,
      directionsCount: directions.length,
    });

    return {
      success: true,
      data: {
        id: itinerary.id,
        title: itinerary.title || undefined,
        editorData,
        directions,
        lastUpdated: itinerary.updatedAt,
        
        // Include form metadata
        destination: itinerary.destination || undefined,
        startDate: itinerary.startDate || undefined,
        endDate: itinerary.endDate || undefined,
        interests: Array.isArray(itinerary.interests) 
          ? (itinerary.interests as unknown[]).filter((item): item is string => typeof item === 'string')
          : undefined,
        travelStyle: itinerary.travelStyle || undefined,
        additionalNotes: itinerary.additionalNotes || undefined,
      },
    };

  } catch (error) {
    console.error("❌ Error loading itinerary:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Lists all itineraries for a user
 */
export async function listItineraries(userId: string): Promise<ListItinerariesResponse> {
  console.log("📋 Loading itineraries list for user:", userId);

  try {
    const itineraries = await prisma.itinerary.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        editorData: true, // Include editorData for extracting stats and images
        
        // Include form metadata
        destination: true,
        startDate: true,
        endDate: true,
        interests: true,
        travelStyle: true,
        additionalNotes: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    console.log("✅ Itineraries list loaded:", itineraries.length);

    // Parse editorData for each itinerary
    const parsedItineraries: ItinerarySummary[] = itineraries.map(itinerary => ({
      ...itinerary,
      title: itinerary.title || undefined, // Convert null to undefined for TypeScript
      editorData: itinerary.editorData ? (() => {
        try {
          return JSON.parse(itinerary.editorData);
        } catch (error) {
          console.error(`Error parsing editorData for itinerary ${itinerary.id}:`, error);
          return undefined;
        }
      })() : undefined,
      
      // Include form metadata
      destination: itinerary.destination || undefined,
      startDate: itinerary.startDate || undefined,
      endDate: itinerary.endDate || undefined,
      interests: Array.isArray(itinerary.interests) 
        ? (itinerary.interests as unknown[]).filter((item): item is string => typeof item === 'string')
        : undefined,
      travelStyle: itinerary.travelStyle || undefined,
      additionalNotes: itinerary.additionalNotes || undefined,
    }));

    return {
      success: true,
      data: parsedItineraries,
    };

  } catch (error) {
    console.error("❌ Error loading itineraries list:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Deletes an itinerary and all its associated data
 */
export async function deleteItinerary(
  userId: string,
  itineraryId: string
): Promise<DeleteItineraryResponse> {
  console.log("🗑️ Deleting itinerary:", itineraryId);

  try {
    await prisma.itinerary.delete({
      where: { id: itineraryId, userId },
    });

    console.log("✅ Itinerary deleted successfully");
    return { success: true };

  } catch (error) {
    console.error("❌ Error deleting itinerary:", error);
    
    if (error instanceof Error && error.message.includes("Record to delete does not exist")) {
      return {
        success: false,
        error: "Itinerary not found",
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Gets the current content hash for an itinerary
 * Used for conflict detection
 */
export async function getItineraryHash(
  userId: string,
  itineraryId: string
): Promise<string | null> {
  try {
    const itinerary = await prisma.itinerary.findUnique({
      where: { id: itineraryId, userId },
      select: { hash: true },
    });

    return itinerary?.hash || null;
  } catch (error) {
    console.error("❌ Error getting itinerary hash:", error);
    return null;
  }
}

/**
 * Updates specific details of an itinerary (like title) without affecting the editor data
 */
export async function updateItineraryDetails(
  userId: string,
  itineraryId: string,
  updates: { title?: string }
): Promise<{ success: boolean; error?: string }> {
  console.log(`📝 Updating itinerary details: ${itineraryId}`, updates);

  try {
    const itinerary = await prisma.itinerary.findUnique({
      where: { id: itineraryId, userId },
      select: { id: true },
    });

    if (!itinerary) {
      return {
        success: false,
        error: "Itinerary not found",
      };
    }

    await prisma.itinerary.update({
      where: { id: itineraryId, userId },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });

    console.log("✅ Itinerary details updated successfully:", itineraryId);
    return { success: true };

  } catch (error) {
    console.error("❌ Error updating itinerary details:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}