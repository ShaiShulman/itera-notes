"use server";

import { auth } from "@/lib/auth";
import {
  saveItinerary as saveItineraryService,
  loadItinerary as loadItineraryService,
  listItineraries as listItinerariesService,
  deleteItinerary as deleteItineraryService,
  getItineraryHash as getItineraryHashService,
} from "./itinerary-service";
import {
  SaveItineraryRequest,
  SaveItineraryResponse,
  LoadItineraryResponse,
  ListItinerariesResponse,
  DeleteItineraryResponse,
} from "./types";

/**
 * Server action to save an itinerary
 */
export async function saveItinerary(
  request: SaveItineraryRequest
): Promise<SaveItineraryResponse> {
  const session = await auth();
  
  if (!session?.user?.id) {
    return {
      id: request.id || "",
      success: false,
      error: "Authentication required",
    };
  }

  return saveItineraryService(session.user.id, request);
}

/**
 * Server action to load an itinerary
 */
export async function loadItinerary(itineraryId: string): Promise<LoadItineraryResponse> {
  const session = await auth();
  
  if (!session?.user?.id) {
    return {
      success: false,
      error: "Authentication required",
    };
  }

  return loadItineraryService(session.user.id, itineraryId);
}

/**
 * Server action to list all itineraries for the current user
 */
export async function listItineraries(): Promise<ListItinerariesResponse> {
  const session = await auth();
  
  if (!session?.user?.id) {
    return {
      success: false,
      error: "Authentication required",
    };
  }

  return listItinerariesService(session.user.id);
}

/**
 * Server action to delete an itinerary
 */
export async function deleteItinerary(itineraryId: string): Promise<DeleteItineraryResponse> {
  const session = await auth();
  
  if (!session?.user?.id) {
    return {
      success: false,
      error: "Authentication required",
    };
  }

  return deleteItineraryService(session.user.id, itineraryId);
}

/**
 * Server action to get the current hash of an itinerary for conflict detection
 */
export async function getItineraryHash(itineraryId: string): Promise<string | null> {
  const session = await auth();
  
  if (!session?.user?.id) {
    return null;
  }

  return getItineraryHashService(session.user.id, itineraryId);
}

/**
 * Server action to update specific details of an itinerary (like name/title)
 */
export async function updateItineraryDetails(
  itineraryId: string,
  updates: { title?: string }
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  
  if (!session?.user?.id) {
    return {
      success: false,
      error: "Authentication required",
    };
  }

  try {
    // Import the service function dynamically to avoid circular imports
    const { updateItineraryDetails: updateItineraryDetailsService } = await import("./itinerary-service");
    
    const result = await updateItineraryDetailsService(session.user.id, itineraryId, updates);
    return result;
  } catch (error) {
    console.error("Error in updateItineraryDetails server action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}