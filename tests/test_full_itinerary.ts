/**
 * Test Full Multi-Step Itinerary Generation
 *
 * Tests the complete flow:
 * 1. Generate skeleton
 * 2. Enrich with Wikipedia
 * 3. Generate final itinerary
 *
 * Usage: node --loader ts-node/esm tests/test_full_itinerary.ts
 */

import { generateItineraryMultiStep } from "../src/features/generateLLM/multiStepGeneration";
import type { EnrichmentProgress } from "../src/features/generateLLM/types";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  data?: any;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, message: string, data?: any) {
  results.push({ name, passed, message, data });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${name}: ${message}`);
  if (data && typeof data === "object") {
    console.log("   Data:", JSON.stringify(data, null, 2).substring(0, 500));
  }
}

async function testFullItineraryGeneration() {
  console.log("\n🚀 Test: Full Multi-Step Itinerary Generation");
  console.log("=============================================\n");

  const progressUpdates: EnrichmentProgress[] = [];

  try {
    console.log("Starting generation for Barcelona, Spain (2 days)...\n");

    const itinerary = await generateItineraryMultiStep({
      destination: "Barcelona, Spain",
      startDate: "2025-08-15",
      endDate: "2025-08-16",
      interests: ["Architecture", "Art", "Food"],
      travelStyle: "cultural",
      transportPreference: "transit",
    });

    // Test 1: Basic structure
    const hasTitle = itinerary.title && itinerary.title.length > 0;
    logTest(
      "Itinerary has title",
      hasTitle,
      hasTitle ? `Title: "${itinerary.title}"` : "Missing title"
    );

    // Test 2: Days
    const hasDays = itinerary.days && itinerary.days.length === 2;
    logTest(
      "Itinerary has correct number of days",
      hasDays,
      hasDays ? "2 days as expected" : `Got ${itinerary.days?.length || 0} days`
    );

    // Test 3: Places
    const totalPlaces = itinerary.days.reduce(
      (sum, day) => sum + day.places.length,
      0
    );
    const hasPlaces = totalPlaces > 0;
    logTest(
      "Itinerary has places",
      hasPlaces,
      hasPlaces ? `${totalPlaces} total places` : "No places found"
    );

    // Test 4: Place structure
    let allPlacesValid = true;
    let placesWithParagraphs = 0;
    let placesWithGoogleData = 0;

    for (const day of itinerary.days) {
      for (const place of day.places) {
        if (
          !place.name ||
          typeof place.lat !== "number" ||
          typeof place.lng !== "number"
        ) {
          allPlacesValid = false;
        }

        if (place.paragraph && place.paragraph.length > 0) {
          placesWithParagraphs++;
        }

        if (place.placeId) {
          placesWithGoogleData++;
        }
      }
    }

    logTest(
      "All places have valid structure",
      allPlacesValid,
      allPlacesValid
        ? "All places have name and coordinates"
        : "Some places missing data"
    );

    // Test 5: Paragraphs
    const hasParagraphs = placesWithParagraphs > 0;
    logTest(
      "Places have narrative paragraphs",
      hasParagraphs,
      hasParagraphs
        ? `${placesWithParagraphs}/${totalPlaces} places have paragraphs`
        : "No paragraphs found",
      { placesWithParagraphs, totalPlaces }
    );

    // Test 6: Google Places enrichment
    const hasGoogleData = placesWithGoogleData > 0;
    logTest(
      "Places enriched with Google Places",
      hasGoogleData,
      hasGoogleData
        ? `${placesWithGoogleData}/${totalPlaces} places have Google data`
        : "No Google Places data found",
      { placesWithGoogleData, totalPlaces }
    );

    // Test 7: Wikipedia progress updates
    const hasProgressUpdates = progressUpdates.length > 0;
    const hasStats = progressUpdates.some((p) => p.type === "statistics");
    logTest(
      "Wikipedia enrichment progress tracked",
      hasProgressUpdates && hasStats,
      hasProgressUpdates && hasStats
        ? `${progressUpdates.length} progress updates received`
        : "No progress updates received"
    );

    // Test 8: Sample place details
    if (itinerary.days.length > 0 && itinerary.days[0].places.length > 0) {
      const samplePlace = itinerary.days[0].places[0];
      console.log("\n📍 Sample Place Details:");
      console.log(`   Name: ${samplePlace.name}`);
      console.log(
        `   Coordinates: ${samplePlace.lat}, ${samplePlace.lng}`
      );
      console.log(
        `   Paragraph: ${samplePlace.paragraph ? samplePlace.paragraph.substring(0, 100) + "..." : "None"}`
      );
      console.log(
        `   Google Place ID: ${samplePlace.placeId || "None"}`
      );
      console.log(
        `   Address: ${samplePlace.address || "None"}`
      );
    }

    return itinerary;
  } catch (error) {
    logTest(
      "Full itinerary generation",
      false,
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
    console.error("\nFull error:", error);
    return null;
  }
}

async function runAllTests() {
  console.log("🧪 Full Itinerary Generation Test");
  console.log("==================================\n");

  await testFullItineraryGeneration();

  // Summary
  console.log("\n📊 Test Summary");
  console.log("===============");
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`Passed: ${passed}/${total}`);

  if (passed === total) {
    console.log("✅ All tests passed!");
  } else {
    console.log("❌ Some tests failed");
    const failed = results.filter((r) => !r.passed);
    console.log("\nFailed tests:");
    failed.forEach((r) => console.log(`  - ${r.name}: ${r.message}`));
  }

  process.exit(passed === total ? 0 : 1);
}

// Run tests
runAllTests().catch((error) => {
  console.error("Fatal error running tests:", error);
  process.exit(1);
});
