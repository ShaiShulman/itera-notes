"use server";

import { revalidatePath } from "next/cache";
import { newItinerarySchema, type NewItineraryForm } from "@/app/create-itinerary/types";
import {
  generateItinerary,
  generateItineraryStream,
  type ItineraryGenerationRequest,
  type GeneratedItinerary,
} from "@/services/openai/itinerary";
import { parseItineraryResponse } from "./responseParser";
import { enrichPlacesWithGoogleData } from "./enrichment";
import type { DirectionsData } from "@/features/directions/types";

export interface ItineraryGenerationResult {
  success: boolean;
  data?: GeneratedItinerary;
  directions?: DirectionsData[];
  error?: string;
}

// Streaming response for real-time display
export async function generateItineraryStreamAction(
  formData: NewItineraryForm,
  httpRequest?: Request
): Promise<Response> {
  try {
    // Validate the form data using Zod schema
    const validationResult = newItinerarySchema.safeParse(formData);

    if (!validationResult.success) {
      const errors = validationResult.error.errors
        .map((err) => err.message)
        .join(", ");
      return new Response(
        JSON.stringify({
          success: false,
          error: `Validation failed: ${errors}`,
        }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
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

    console.log("🚀 Starting OpenAI streaming generation...");
    
    // Create a TransformStream for proper browser compatibility
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    
    // Start the streaming process
    (async () => {
      try {
        const stream = await generateItineraryStream(request);
        const reader = stream.getReader();
        
        while (true) {
          // Check if the request was cancelled
          if (httpRequest?.signal?.aborted) {
            console.log("🛑 Request cancelled, stopping stream");
            break;
          }
          
          const { done, value } = await reader.read();
          if (done) break;
          
          // Write each chunk to the writable stream
          await writer.write(encoder.encode(value));
        }
      } catch (error) {
        console.error("❌ Streaming error:", error);
        if (error instanceof Error && error.message.includes("aborted")) {
          console.log("✅ Stream properly cancelled");
        } else {
          await writer.write(encoder.encode(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      } finally {
        await writer.close();
      }
    })();
    
    console.log("✅ OpenAI streaming setup completed");

    // Return streaming response with proper headers
    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("❌ Error in generateItineraryStreamAction:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `Failed to generate streaming itinerary: ${errorMessage}`,
        details: process.env.NODE_ENV === 'development' ? {
          originalError: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        } : undefined,
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

// Complete generation for final processing (non-streaming fallback)
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

// Helper function to process streamed content and create final itinerary
export async function processStreamedContent(
  streamedContent: string,
  request: ItineraryGenerationRequest
): Promise<GeneratedItinerary> {
  const totalDays =
    (new Date(request.endDate).getTime() - new Date(request.startDate).getTime()) / 86400000 + 1;

  // Parse the complete streamed response
  const parsedItinerary = parseItineraryResponse(
    streamedContent,
    request.destination,
    request.startDate,
    totalDays
  );

  // Enrich places with Google Places API data
  const enrichedItinerary = await enrichPlacesWithGoogleData(parsedItinerary);
  
  return enrichedItinerary;
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