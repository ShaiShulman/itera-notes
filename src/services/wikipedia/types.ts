export interface WikipediaSearchResult {
  title: string;
  pageid: number;
  snippet: string;
}

export interface WikipediaArticle {
  pageid: number;
  title: string;
  extract: string; // Plain text extract
  content?: string; // Full wikitext content if needed
}

export interface WikipediaEnrichment {
  placeName: string;
  found: boolean;
  wikipediaTitle?: string;
  description?: string; // Extracted description from Wikipedia
  interestingFacts?: string[]; // 1-2 interesting facts based on user preferences
  error?: string;
}

export interface WikipediaSearchOptions {
  fuzzyMatch?: boolean; // Try variations without prefixes
  maxResults?: number;
}
