/**
 * Test Wikipedia extraction functionality
 *
 * Tests:
 * 1. Wikipedia search for a place name
 * 2. Fetching Wikipedia article
 * 3. Extracting description and interesting facts using OpenAI
 *
 * Usage: node --loader ts-node/esm tests/test_wikipedia_extraction.ts
 */

import {
  searchWikipedia,
  fetchWikipediaArticle,
  findBestWikipediaMatch,
  generateQueryVariations,
} from "../src/services/wikipedia/wikipediaService";
import { enrichPlaceWithWikipedia } from "../src/services/wikipedia/wikipediaExtractor";

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
  if (data) {
    console.log("   Data:", JSON.stringify(data, null, 2));
  }
}

async function testWikipediaSearch() {
  console.log("\n🔍 Test 1: Wikipedia Search");
  console.log("----------------------------");

  try {
    const results = await searchWikipedia("Eiffel Tower");

    if (results.length > 0) {
      logTest(
        "Search for 'Eiffel Tower'",
        true,
        `Found ${results.length} results`,
        results[0]
      );
    } else {
      logTest(
        "Search for 'Eiffel Tower'",
        false,
        "No results found"
      );
    }
  } catch (error) {
    logTest(
      "Search for 'Eiffel Tower'",
      false,
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function testFetchArticle() {
  console.log("\n📄 Test 2: Fetch Wikipedia Article");
  console.log("-----------------------------------");

  try {
    // First search for the Eiffel Tower to get its page ID
    const searchResults = await searchWikipedia("Eiffel Tower");

    if (searchResults.length === 0) {
      logTest(
        "Fetch article for Eiffel Tower",
        false,
        "Could not find page ID"
      );
      return;
    }

    const pageId = searchResults[0].pageid;
    const article = await fetchWikipediaArticle(pageId);

    if (article && article.extract.length > 0) {
      logTest(
        "Fetch article for Eiffel Tower",
        true,
        `Retrieved article with ${article.extract.length} characters`,
        {
          title: article.title,
          extractPreview: article.extract.substring(0, 200) + "...",
        }
      );
    } else {
      logTest(
        "Fetch article for Eiffel Tower",
        false,
        "Article found but extract is empty"
      );
    }
  } catch (error) {
    logTest(
      "Fetch article for Eiffel Tower",
      false,
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function testFuzzyMatching() {
  console.log("\n🔎 Test 3: Fuzzy Matching");
  console.log("-------------------------");

  const testCases = [
    { input: "Mount Fuji", expected: ["Mount Fuji", "Fuji"] },
    { input: "Lake Como", expected: ["Lake Como", "Como"] },
    { input: "The Louvre", expected: ["The Louvre", "Louvre"] },
  ];

  for (const testCase of testCases) {
    const variations = generateQueryVariations(testCase.input);
    const hasExpected = testCase.expected.every((exp) =>
      variations.includes(exp)
    );

    logTest(
      `Query variations for '${testCase.input}'`,
      hasExpected,
      hasExpected
        ? `Generated ${variations.length} variations including expected ones`
        : `Missing expected variations`,
      { variations }
    );
  }
}

async function testBestMatch() {
  console.log("\n🎯 Test 4: Find Best Wikipedia Match");
  console.log("------------------------------------");

  const testPlaces = [
    "Colosseum",
    "Mount Vesuvius",
    "Lake Garda",
    "Nonexistent Random Place XYZ123",
  ];

  for (const placeName of testPlaces) {
    try {
      const article = await findBestWikipediaMatch(placeName);

      if (article) {
        logTest(
          `Find best match for '${placeName}'`,
          true,
          `Found: ${article.title}`,
          {
            title: article.title,
            extractLength: article.extract.length,
          }
        );
      } else {
        const shouldFail = placeName.includes("Nonexistent");
        logTest(
          `Find best match for '${placeName}'`,
          shouldFail,
          shouldFail ? "Correctly returned no match" : "No match found"
        );
      }
    } catch (error) {
      logTest(
        `Find best match for '${placeName}'`,
        false,
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

async function testOpenAIExtraction() {
  console.log("\n✨ Test 5: OpenAI Extraction");
  console.log("----------------------------");

  try {
    const enrichment = await enrichPlaceWithWikipedia("Colosseum", {
      userInterests: ["History", "Architecture"],
      travelStyle: "cultural",
      destination: "Rome, Italy",
    });

    if (enrichment.found && enrichment.description) {
      logTest(
        "Extract description and facts for Colosseum",
        true,
        `Extracted description (${enrichment.description.length} chars) and ${enrichment.interestingFacts?.length || 0} facts`,
        {
          wikipediaTitle: enrichment.wikipediaTitle,
          description: enrichment.description,
          interestingFacts: enrichment.interestingFacts,
        }
      );
    } else {
      logTest(
        "Extract description and facts for Colosseum",
        false,
        "Failed to extract information"
      );
    }
  } catch (error) {
    logTest(
      "Extract description and facts for Colosseum",
      false,
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function runAllTests() {
  console.log("🧪 Wikipedia Extraction Tests");
  console.log("==============================\n");

  await testWikipediaSearch();
  await testFetchArticle();
  await testFuzzyMatching();
  await testBestMatch();
  await testOpenAIExtraction();

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
