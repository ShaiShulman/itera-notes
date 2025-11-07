"use server";

import { callOpenAI } from "@/services/openai/llmService";
import { parseItineraryResponse } from "./responseParser";
import { parseSkeletonResponse } from "./skeletonParser";
import { enrichPlacesWithWikipedia } from "@/services/wikipedia/wikipediaExtractor";
import { enrichPlacesWithGoogleData } from "./enrichment";
import {
  createSkeletonPrompt,
  createEnrichedItineraryPrompt,
  type EnrichedDayData,
  type EnrichedPlaceData,
} from "./promptBuilder";
import type {
  GeneratedItinerary,
  SkeletonItinerary,
  EnrichmentProgress,
} from "./types";

export interface MultiStepGenerationRequest {
  destination: string;
  startDate: string;
  endDate: string;
  interests: string[];
  travelStyle: string;
  transportPreference?: string;
  additionalNotes?: string;
  progressWriter?: WritableStreamDefaultWriter<Uint8Array>;
}

/**
 * Helper function to send progress updates via stream
 */
async function sendProgress(
  writer: WritableStreamDefaultWriter<Uint8Array> | undefined,
  progress: EnrichmentProgress
) {
  if (writer) {
    try {
      const encoder = new TextEncoder();
      const message = JSON.stringify(progress) + "\n";
      await writer.write(encoder.encode(message));
    } catch (error) {
      console.error("Error sending progress:", error);
    }
  }
}

/**
 * Step 1: Generate skeleton itinerary with places and basic info
 */
async function generateSkeleton(
  request: MultiStepGenerationRequest
): Promise<SkeletonItinerary> {
  console.log("📝 STEP 1: Generating skeleton itinerary...");

  const {
    destination,
    startDate,
    endDate,
    interests,
    travelStyle,
    transportPreference,
    additionalNotes,
    progressWriter,
  } = request;

  // Send progress: skeleton generation starting
  await sendProgress(progressWriter, {
    type: "skeleton_generating",
  });

  const totalDays =
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000 +
    1;

  const prompt = createSkeletonPrompt({
    destination,
    startDate,
    endDate,
    totalDays,
    interests,
    travelStyle,
    transportPreference,
    additionalNotes,
  });

  const response = await callOpenAI(prompt);
  const skeleton = parseSkeletonResponse(
    response,
    destination,
    startDate,
    totalDays
  );

  const totalPlaces = skeleton.days.reduce((sum, day) => sum + day.places.length, 0);

  console.log(
    `✅ STEP 1 Complete: Generated skeleton with ${skeleton.days.length} days`
  );
  console.log(
    `   Total places: ${totalPlaces}`
  );

  // Send progress: skeleton generation complete
  await sendProgress(progressWriter, {
    type: "skeleton_generated",
    placesCount: totalPlaces,
  });

  return skeleton;
}

/**
 * Step 2: Enrich places with Wikipedia data
 */
async function enrichWithWikipedia(
  skeleton: SkeletonItinerary,
  request: MultiStepGenerationRequest
): Promise<EnrichedDayData[]> {
  console.log("📚 STEP 2: Enriching places with Wikipedia data...");

  const { destination, interests, travelStyle, progressWriter } = request;

  // Collect all place names
  const allPlaceNames: string[] = [];
  for (const day of skeleton.days) {
    for (const place of day.places) {
      allPlaceNames.push(place.name);
    }
  }

  console.log(`   Processing ${allPlaceNames.length} places...`);

  // Enrich all places with Wikipedia
  const enrichments = await enrichPlacesWithWikipedia(
    allPlaceNames,
    {
      userInterests: interests,
      travelStyle,
      destination,
    },
    async (enrichment, index, total) => {
      console.log(
        `   [${index}/${total}] ${enrichment.placeName}: ${enrichment.found ? "✅ Found" : "❌ Not found"}`
      );

      // Send progress for each place enriched
      await sendProgress(progressWriter, {
        type: "place_enriched",
        placeName: enrichment.placeName,
        found: enrichment.found,
        index,
        total,
      });
    }
  );

  // Create enriched days with Wikipedia data (use Wikipedia facts if available, otherwise skeleton facts)
  const enrichedDays: EnrichedDayData[] = [];
  let enrichmentIndex = 0;

  for (const day of skeleton.days) {
    const enrichedPlaces: EnrichedPlaceData[] = [];

    for (const place of day.places) {
      const enrichment = enrichments[enrichmentIndex++];

      // Prefer Wikipedia facts if found, otherwise use skeleton facts
      const facts =
        enrichment.found && enrichment.interestingFacts && enrichment.interestingFacts.length > 0
          ? enrichment.interestingFacts
          : place.interestingFacts || [];

      const factSource = enrichment.found && enrichment.interestingFacts && enrichment.interestingFacts.length > 0
        ? "Wikipedia"
        : "skeleton";

      console.log(`  📝 Using ${factSource} facts for "${place.name}"`);

      enrichedPlaces.push({
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        activities: place.activities,
        time: place.time,
        wikipediaDescription: enrichment.description,
        interestingFacts: facts,
      });
    }

    enrichedDays.push({
      dayNumber: day.dayNumber,
      date: day.date,
      title: day.title,
      transportMode: day.transportMode,
      places: enrichedPlaces,
    });
  }

  // Log statistics
  const foundCount = enrichments.filter((e) => e.found).length;
  console.log(
    `✅ STEP 2 Complete: Wikipedia enrichment done (${foundCount}/${allPlaceNames.length} places found)`
  );

  // Send statistics
  await sendProgress(progressWriter, {
    type: "statistics",
    foundCount,
    totalCount: allPlaceNames.length,
  });

  return enrichedDays;
}

/**
 * Step 3: Generate final rich itinerary with Wikipedia data
 */
async function generateFinalItinerary(
  skeleton: SkeletonItinerary,
  enrichedDays: EnrichedDayData[],
  request: MultiStepGenerationRequest
): Promise<GeneratedItinerary> {
  console.log("✨ STEP 3: Generating final rich itinerary...");

  const { destination, interests, travelStyle, startDate } = request;

  const prompt = createEnrichedItineraryPrompt({
    destination,
    title: skeleton.title,
    enrichedDays,
    interests,
    travelStyle,
  });

  const response = await callOpenAI(prompt);

  // Parse using existing parser
  const itinerary = parseItineraryResponse(
    response,
    destination,
    startDate,
    skeleton.totalDays
  );

  console.log(`✅ STEP 3 Complete: Final itinerary generated`);

  return itinerary;
}

/**
 * Multi-step itinerary generation with Wikipedia enrichment
 */
export async function generateItineraryMultiStep(
  request: MultiStepGenerationRequest
): Promise<GeneratedItinerary> {
  console.log("🚀 Starting multi-step itinerary generation...");
  console.log(`   Destination: ${request.destination}`);
  console.log(`   Dates: ${request.startDate} to ${request.endDate}`);
  console.log(`   Interests: ${request.interests.join(", ")}`);

  try {
    // Step 1: Generate skeleton
    const skeleton = await generateSkeleton(request);

    // Step 2: Enrich with Wikipedia
    const enrichedDays = await enrichWithWikipedia(skeleton, request);

    // Step 3: Generate final itinerary
    const finalItinerary = await generateFinalItinerary(
      skeleton,
      enrichedDays,
      request
    );

    // Step 4: Enrich with Google Places (existing step)
    console.log("🔍 STEP 4: Enriching with Google Places data...");
    const enrichedItinerary = await enrichPlacesWithGoogleData(finalItinerary);
    console.log("✅ STEP 4 Complete: Google Places enrichment done");

    console.log("🎉 Multi-step generation complete!");

    return enrichedItinerary;
  } catch (error) {
    console.error("❌ Error in multi-step generation:", error);
    throw error;
  }
}
