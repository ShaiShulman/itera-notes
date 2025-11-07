import { callOpenAI } from "@/services/openai/llmService";
import { WikipediaArticle, WikipediaEnrichment } from "./types";
import { findBestWikipediaMatch } from "./wikipediaService";

interface ExtractionContext {
  userInterests: string[];
  travelStyle: string;
  destination: string;
}

/**
 * Create a prompt for extracting relevant information from Wikipedia article
 */
function createExtractionPrompt(
  article: WikipediaArticle,
  placeName: string,
  context: ExtractionContext
): string {
  return `You are helping create a travel itinerary for a traveler interested in: ${context.userInterests.join(", ")}.
Their travel style is: ${context.travelStyle}.
They are visiting: ${context.destination}.

Below is a Wikipedia article about "${article.title}":

${article.extract}

Based on this article and the traveler's interests, extract:
1. A brief description (1-2 sentences, max 50 words) that would be relevant and interesting to this specific traveler
2. Exactly 2 interesting facts that would appeal to someone with these interests

Return your response in this exact JSON format:
{
  "description": "Brief description here",
  "facts": ["Fact 1", "Fact 2"]
}

Focus on aspects that relate to the traveler's interests: ${context.userInterests.join(", ")}.
Keep facts concise (max 25 words each).
If the article doesn't contain information relevant to the traveler's interests, provide general interesting facts about the place.`;
}

/**
 * Extract description and interesting facts from Wikipedia article using OpenAI
 */
async function extractRelevantInformation(
  article: WikipediaArticle,
  placeName: string,
  context: ExtractionContext
): Promise<{ description: string; facts: string[] }> {
  // Limit article text to intro + next 400 words
  const words = article.extract.split(" ");
  const limitedText = words.slice(0, 400).join(" ");

  // Create a limited article object for the prompt
  const limitedArticle = {
    ...article,
    extract: limitedText,
  };

  const prompt = createExtractionPrompt(limitedArticle, placeName, context);

  try {
    const response = await callOpenAI(prompt, {
      temperature: 0.7,
      maxTokens: 300,
    });

    // Parse JSON response
    const parsed = JSON.parse(response);

    return {
      description: parsed.description || "",
      facts: Array.isArray(parsed.facts) ? parsed.facts.slice(0, 2) : [],
    };
  } catch (error) {
    console.error(`Error extracting information from Wikipedia:`, error);

    // Fallback: use first 50 words of article as description
    const fallbackWords = article.extract.split(" ").slice(0, 50);
    return {
      description: fallbackWords.join(" ") + "...",
      facts: [],
    };
  }
}

/**
 * Enrich a place with Wikipedia data
 * Searches for Wikipedia article, extracts relevant information
 */
export async function enrichPlaceWithWikipedia(
  placeName: string,
  context: ExtractionContext
): Promise<WikipediaEnrichment> {
  console.log(`📚 Enriching "${placeName}" with Wikipedia data`);

  try {
    // Find best matching Wikipedia article
    const article = await findBestWikipediaMatch(placeName, {
      fuzzyMatch: true,
    });

    if (!article) {
      console.log(`  ❌ Wikipedia search: NOT FOUND for "${placeName}"`);
      return {
        placeName,
        found: false,
      };
    }

    console.log(`  ✅ Wikipedia search: FOUND "${article.title}" for "${placeName}"`);

    // Extract relevant information using OpenAI
    const { description, facts } = await extractRelevantInformation(
      article,
      placeName,
      context
    );

    console.log(`  ✅ Extracted description (${description.length} chars) and ${facts.length} facts`);

    return {
      placeName,
      found: true,
      wikipediaTitle: article.title,
      description,
      interestingFacts: facts,
    };
  } catch (error) {
    console.error(`Error enriching place "${placeName}":`, error);
    return {
      placeName,
      found: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Enrich multiple places with Wikipedia data in parallel using Promise.allSettled
 */
export async function enrichPlacesWithWikipedia(
  placeNames: string[],
  context: ExtractionContext,
  onProgress?: (enrichment: WikipediaEnrichment, index: number, total: number) => void | Promise<void>
): Promise<WikipediaEnrichment[]> {
  console.log(`📚 Enriching ${placeNames.length} places with Wikipedia data in parallel`);

  // Create promises for all place enrichments
  const enrichmentPromises = placeNames.map((placeName) =>
    enrichPlaceWithWikipedia(placeName, context)
  );

  // Execute all enrichments in parallel using Promise.allSettled
  const results = await Promise.allSettled(enrichmentPromises);

  // Process results and call progress callback
  const enrichments: WikipediaEnrichment[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];

    if (result.status === "fulfilled") {
      enrichments.push(result.value);

      // Call progress callback if provided
      if (onProgress) {
        await onProgress(result.value, i + 1, placeNames.length);
      }
    } else {
      // Handle rejected promise - create a failed enrichment
      const placeName = placeNames[i];
      console.error(`❌ Failed to enrich "${placeName}":`, result.reason);

      const failedEnrichment: WikipediaEnrichment = {
        placeName,
        found: false,
        error: result.reason instanceof Error ? result.reason.message : "Unknown error",
      };

      enrichments.push(failedEnrichment);

      if (onProgress) {
        await onProgress(failedEnrichment, i + 1, placeNames.length);
      }
    }
  }

  // Log statistics
  const foundCount = enrichments.filter((e) => e.found).length;
  console.log(
    `📊 Wikipedia enrichment complete: ${foundCount}/${placeNames.length} places found`
  );

  return enrichments;
}
