import {
  WikipediaSearchResult,
  WikipediaArticle,
  WikipediaSearchOptions,
} from "./types";

const WIKIPEDIA_API_BASE = "https://en.wikipedia.org/w/api.php";

/**
 * Search Wikipedia for articles matching a place name
 */
export async function searchWikipedia(
  query: string,
  options: WikipediaSearchOptions = {}
): Promise<WikipediaSearchResult[]> {
  const { maxResults = 5 } = options;

  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    format: "json",
    origin: "*",
    srlimit: maxResults.toString(),
  });

  try {
    const response = await fetch(`${WIKIPEDIA_API_BASE}?${params}`);
    const data = await response.json();

    if (data.query && data.query.search) {
      return data.query.search.map((result: any) => ({
        title: result.title,
        pageid: result.pageid,
        snippet: result.snippet,
      }));
    }

    return [];
  } catch (error) {
    console.error(`Error searching Wikipedia for "${query}":`, error);
    return [];
  }
}

/**
 * Fetch a Wikipedia article by page ID
 */
export async function fetchWikipediaArticle(
  pageid: number
): Promise<WikipediaArticle | null> {
  const params = new URLSearchParams({
    action: "query",
    pageids: pageid.toString(),
    prop: "extracts",
    exintro: "true", // Get only the introduction section
    explaintext: "true", // Get plain text instead of HTML
    format: "json",
    origin: "*",
  });

  try {
    const response = await fetch(`${WIKIPEDIA_API_BASE}?${params}`);
    const data = await response.json();

    if (data.query && data.query.pages) {
      const page = data.query.pages[pageid];
      if (page && !page.missing) {
        return {
          pageid: page.pageid,
          title: page.title,
          extract: page.extract || "",
        };
      }
    }

    return null;
  } catch (error) {
    console.error(`Error fetching Wikipedia article ${pageid}:`, error);
    return null;
  }
}

/**
 * Fetch a Wikipedia article by title
 */
export async function fetchWikipediaArticleByTitle(
  title: string
): Promise<WikipediaArticle | null> {
  const params = new URLSearchParams({
    action: "query",
    titles: title,
    prop: "extracts",
    exintro: "true",
    explaintext: "true",
    format: "json",
    origin: "*",
  });

  try {
    const response = await fetch(`${WIKIPEDIA_API_BASE}?${params}`);
    const data = await response.json();

    if (data.query && data.query.pages) {
      const pages = Object.values(data.query.pages) as any[];
      const page = pages[0];

      if (page && !page.missing) {
        return {
          pageid: page.pageid,
          title: page.title,
          extract: page.extract || "",
        };
      }
    }

    return null;
  } catch (error) {
    console.error(`Error fetching Wikipedia article "${title}":`, error);
    return null;
  }
}

/**
 * Generate query variations for fuzzy matching
 * Removes common prefixes like "Mount", "Lake", "Fort", etc.
 */
export function generateQueryVariations(placeName: string): string[] {
  const variations: string[] = [placeName];

  // List of common prefixes to try removing
  const prefixes = [
    "Mount ",
    "Mt. ",
    "Mt ",
    "Mountain ",
    "Lake ",
    "River ",
    "Fort ",
    "Castle ",
    "Palace ",
    "Temple ",
    "Monastery ",
    "Cathedral ",
    "Church ",
    "Shrine ",
    "Valley ",
    "Peak ",
    "Hill ",
    "Bay ",
    "Beach ",
    "Island ",
    "National Park",
    "State Park",
    "Historic ",
    "Old ",
    "New ",
    "Saint ",
    "St. ",
    "St ",
  ];

  // Try removing each prefix
  for (const prefix of prefixes) {
    if (placeName.startsWith(prefix)) {
      variations.push(placeName.substring(prefix.length));
    }
  }

  // Try variations with "the" removed
  if (placeName.toLowerCase().startsWith("the ")) {
    variations.push(placeName.substring(4));
  }

  return [...new Set(variations)]; // Remove duplicates
}

/**
 * Find the best matching Wikipedia article for a place
 * Uses fuzzy matching by trying variations of the place name
 */
export async function findBestWikipediaMatch(
  placeName: string,
  options: WikipediaSearchOptions = {}
): Promise<WikipediaArticle | null> {
  const { fuzzyMatch = true } = options;

  console.log(`🔍 Searching Wikipedia for: "${placeName}"`);

  // Generate query variations if fuzzy matching is enabled
  const queries = fuzzyMatch
    ? generateQueryVariations(placeName)
    : [placeName];

  console.log(`  Trying ${queries.length} query variations`);

  for (const query of queries) {
    console.log(`  Searching: "${query}"`);

    const results = await searchWikipedia(query, { maxResults: 3 });

    if (results.length > 0) {
      console.log(`  ✅ Found ${results.length} results for "${query}"`);

      // Fetch the first (most relevant) result
      const article = await fetchWikipediaArticle(results[0].pageid);

      if (article && article.extract.length > 100) {
        console.log(`  ✅ Retrieved article: "${article.title}"`);
        return article;
      }
    }
  }

  console.log(`  ❌ No suitable Wikipedia article found for "${placeName}"`);
  return null;
}
