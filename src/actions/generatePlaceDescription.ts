"use server";

import { callOpenAI } from "@/services/openai/llmService";
import {
  createPlaceDescriptionPrompt,
  PlaceDescriptionContext,
} from "@/features/generateLLM/promptBuilder";
import { parsePlaceDescriptionResponse } from "@/features/generateLLM/placeSuggestionParser";
import { getUniqueId } from "@/utils/getUniqueId";

export interface GeneratePlaceDescriptionRequest {
  placeName: string;
  placeAddress?: string;
  dayContext: {
    dayNumber: number;
    dayTitle: string;
    dayDate: string;
    existingPlaces: Array<{
      name: string;
      address?: string;
    }>;
  };
  travelStyle: string;
  interests: string[];
  destination: string;
  existingLinkedParagraphId?: string;
}

export interface GeneratedPlaceDescription {
  content: string;
  linkedParagraphId: string;
  success: boolean;
  error?: string;
}

export async function generatePlaceDescriptionAction(
  request: GeneratePlaceDescriptionRequest
): Promise<GeneratedPlaceDescription> {
  try {
    // Create the context object
    const context: PlaceDescriptionContext = {
      placeName: request.placeName,
      placeAddress: request.placeAddress,
      dayContext: request.dayContext,
      travelStyle: request.travelStyle,
      interests: request.interests,
      destination: request.destination,
    };

    // Generate the prompt
    const prompt = createPlaceDescriptionPrompt(context);

    const response = await callOpenAI(prompt);

    const parsedResponse = parsePlaceDescriptionResponse(response);

    // Use existing linkedParagraphId if provided, otherwise generate a new one
    const linkedParagraphId =
      request.existingLinkedParagraphId || getUniqueId();

    console.log("🎉 Successfully generated place description:", {
      placeName: request.placeName,
      contentLength: parsedResponse.cleanedContent.length,
      linkedParagraphId: linkedParagraphId.slice(0, 8) + "...",
      preview: parsedResponse.cleanedContent.substring(0, 100) + "...",
    });

    return {
      content: parsedResponse.cleanedContent,
      linkedParagraphId,
      success: true,
    };
  } catch (error) {
    console.error("❌ Failed to generate place description:", {
      placeName: request.placeName,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      content: "",
      linkedParagraphId: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
