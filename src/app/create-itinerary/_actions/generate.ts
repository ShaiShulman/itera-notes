"use server";

import { revalidatePath } from "next/cache";
import { newItinerarySchema, type NewItineraryForm } from "../types";
import {
  generateItinerary,
  type ItineraryGenerationRequest,
  type GeneratedItinerary,
} from "@/services/openai/itinerary";

export interface ItineraryGenerationResult {
  success: boolean;
  data?: GeneratedItinerary;
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

    // Revalidate the itineraries page to ensure fresh data
    revalidatePath("/itineraries");

    return {
      success: true,
      data: generatedItinerary,
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
