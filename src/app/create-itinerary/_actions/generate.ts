"use server";

import { revalidatePath } from "next/cache";
import { newItinerarySchema, type NewItineraryForm } from "../types";
import {
  generateItinerary,
  type ItineraryGenerationRequest,
  type GeneratedItinerary,
} from "@/services/openai/itinerary";
import type { DirectionsData } from "@/features/directions/types";

export interface ItineraryGenerationResult {
  success: boolean;
  data?: GeneratedItinerary;
  directions?: DirectionsData[];
  error?: string;
}

export async function generateItineraryAction(
  formData: NewItineraryForm
): Promise<ItineraryGenerationResult> {
  try {
    // Validate the form data using Zod schema
    const validationResult = newItinerarySchema.safeParse(formData);

    if (!validationResult.success) {
      const errors = validationResult.error.errors
        .map((err) => err.message)
        .join(", ");
      return {
        success: false,
        error: `Validation failed: ${errors}`,
      };
    }

    const {
      destination,
      startDate,
      endDate,
      interests,
      travelStyle,
      additionalNotes,
    } = validationResult.data;

    // Prepare the request for OpenAI service
    const request: ItineraryGenerationRequest = {
      destination,
      startDate,
      endDate,
      interests,
      travelStyle,
      additionalNotes,
    };

    // Generate the itinerary using OpenAI
    const generatedItinerary = await generateItinerary(request);

    // Generate directions for the itinerary and update driving times
    let directions: DirectionsData[] = [];
    let updatedItinerary = generatedItinerary;
    
    try {
      console.log("🚗 Generating directions for new itinerary...");
      const { generateDirectionsWithTimes } = await import("@/features/directions/generator");
      const result = await generateDirectionsWithTimes(generatedItinerary);
      
      directions = result.directions;
      updatedItinerary = result.updatedItinerary;
      
      console.log(
        `✅ Generated ${directions.length} direction routes and updated driving times for new itinerary`
      );
    } catch (error) {
      console.error(
        "⚠️ Failed to generate directions for itinerary (continuing anyway):",
        error
      );
      // Don't fail the entire operation if directions fail
    }

    // Debug: Check if paragraph field exists in final data
    console.log(
      `🔍 FINAL DATA CHECK - Sample place before returning to client:`,
      JSON.stringify(updatedItinerary.days[0]?.places[0], null, 2)
    );

    // Revalidate the itineraries page to ensure fresh data
    revalidatePath("/itineraries");

    return {
      success: true,
      data: updatedItinerary,
      directions,
    };
  } catch (error) {
    console.error("Error in generateItineraryAction:", error);

    // Return a user-friendly error message
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return {
      success: false,
      error: `Failed to generate itinerary: ${errorMessage}`,
    };
  }
}

// Helper function to validate environment variables
export async function validateEnvironment(): Promise<{
  valid: boolean;
  missingVars: string[];
}> {
  const requiredVars = ["OPENAI_API_KEY"];
  const missingVars: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  return {
    valid: missingVars.length === 0,
    missingVars,
  };
}
