/**
 * Test Skeleton Itinerary Generation
 *
 * Tests:
 * 1. Generate skeleton prompt
 * 2. Call OpenAI to generate skeleton
 * 3. Parse skeleton response
 *
 * Usage: node --loader ts-node/esm tests/test_skeleton_generation.ts
 */

import { callOpenAI } from "../src/services/openai/llmService";
import { createSkeletonPrompt } from "../src/features/generateLLM/promptBuilder";
import { parseSkeletonResponse } from "../src/features/generateLLM/skeletonParser";

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

async function testSkeletonPrompt() {
  console.log("\n📝 Test 1: Generate Skeleton Prompt");
  console.log("-----------------------------------");

  try {
    const prompt = createSkeletonPrompt({
      destination: "Rome, Italy",
      startDate: "2025-06-01",
      endDate: "2025-06-03",
      totalDays: 3,
      interests: ["History", "Art", "Food"],
      travelStyle: "cultural",
      transportPreference: "walking",
    });

    const hasRequiredElements =
      prompt.includes("Rome, Italy") &&
      prompt.includes("2025-06-01") &&
      prompt.includes("History") &&
      prompt.includes("cultural");

    logTest(
      "Create skeleton prompt",
      hasRequiredElements,
      hasRequiredElements
        ? "Prompt includes all required elements"
        : "Missing required elements",
      {
        promptLength: prompt.length,
        preview: prompt.substring(0, 200) + "...",
      }
    );
  } catch (error) {
    logTest(
      "Create skeleton prompt",
      false,
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function testSkeletonGeneration() {
  console.log("\n🤖 Test 2: Generate Skeleton with OpenAI");
  console.log("----------------------------------------");

  try {
    const prompt = createSkeletonPrompt({
      destination: "Paris, France",
      startDate: "2025-07-10",
      endDate: "2025-07-11",
      totalDays: 2,
      interests: ["Art", "Architecture"],
      travelStyle: "cultural",
      transportPreference: "transit",
    });

    console.log("   Calling OpenAI...");
    const response = await callOpenAI(prompt);

    if (response && response.length > 100) {
      logTest(
        "Generate skeleton with OpenAI",
        true,
        `Generated skeleton (${response.length} characters)`,
        {
          responseLength: response.length,
          preview: response.substring(0, 300) + "...",
        }
      );

      return response;
    } else {
      logTest(
        "Generate skeleton with OpenAI",
        false,
        "Response too short or empty"
      );
      return null;
    }
  } catch (error) {
    logTest(
      "Generate skeleton with OpenAI",
      false,
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

async function testSkeletonParsing(skeletonResponse: string | null) {
  console.log("\n🔍 Test 3: Parse Skeleton Response");
  console.log("----------------------------------");

  if (!skeletonResponse) {
    logTest(
      "Parse skeleton response",
      false,
      "No skeleton response available to parse"
    );
    return;
  }

  try {
    const skeleton = parseSkeletonResponse(
      skeletonResponse,
      "Paris, France",
      "2025-07-10",
      2
    );

    const hasTitle = skeleton.title && skeleton.title.length > 0;
    const hasDays = skeleton.days && skeleton.days.length === 2;
    const hasPlaces =
      skeleton.days &&
      skeleton.days.length > 0 &&
      skeleton.days[0].places.length > 0;

    const allChecks = hasTitle && hasDays && hasPlaces;

    logTest(
      "Parse skeleton response",
      allChecks,
      allChecks
        ? `Parsed skeleton with ${skeleton.days.length} days and ${skeleton.days.reduce((sum, day) => sum + day.places.length, 0)} total places`
        : "Parsing incomplete or failed",
      {
        title: skeleton.title,
        totalDays: skeleton.days.length,
        firstDay: skeleton.days[0]
          ? {
              title: skeleton.days[0].title,
              placesCount: skeleton.days[0].places.length,
              firstPlace: skeleton.days[0].places[0]
                ? {
                    name: skeleton.days[0].places[0].name,
                    activities: skeleton.days[0].places[0].activities,
                  }
                : null,
            }
          : null,
      }
    );

    return skeleton;
  } catch (error) {
    logTest(
      "Parse skeleton response",
      false,
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

async function testSkeletonStructure(skeleton: any) {
  console.log("\n🏗️  Test 4: Validate Skeleton Structure");
  console.log("---------------------------------------");

  if (!skeleton) {
    logTest(
      "Validate skeleton structure",
      false,
      "No skeleton available to validate"
    );
    return;
  }

  try {
    // Check day structure
    const allDaysHaveRequiredFields = skeleton.days.every(
      (day: any) =>
        day.dayNumber &&
        day.date &&
        day.title &&
        day.transportMode &&
        Array.isArray(day.places)
    );

    logTest(
      "All days have required fields",
      allDaysHaveRequiredFields,
      allDaysHaveRequiredFields
        ? "All days properly structured"
        : "Some days missing fields"
    );

    // Check place structure
    let allPlacesValid = true;
    for (const day of skeleton.days) {
      for (const place of day.places) {
        if (
          !place.name ||
          typeof place.lat !== "number" ||
          typeof place.lng !== "number" ||
          !place.activities
        ) {
          allPlacesValid = false;
          break;
        }
      }
    }

    logTest(
      "All places have required fields",
      allPlacesValid,
      allPlacesValid
        ? "All places properly structured"
        : "Some places missing fields"
    );

    // Check coordinates are realistic
    let coordsValid = true;
    for (const day of skeleton.days) {
      for (const place of day.places) {
        if (
          Math.abs(place.lat) > 90 ||
          Math.abs(place.lng) > 180 ||
          place.lat === 0 ||
          place.lng === 0
        ) {
          coordsValid = false;
          break;
        }
      }
    }

    logTest(
      "Coordinates are realistic",
      coordsValid,
      coordsValid
        ? "All coordinates within valid ranges"
        : "Some coordinates invalid"
    );
  } catch (error) {
    logTest(
      "Validate skeleton structure",
      false,
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function runAllTests() {
  console.log("🧪 Skeleton Generation Tests");
  console.log("=============================\n");

  await testSkeletonPrompt();
  const skeletonResponse = await testSkeletonGeneration();
  const skeleton = await testSkeletonParsing(skeletonResponse);
  await testSkeletonStructure(skeleton);

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
