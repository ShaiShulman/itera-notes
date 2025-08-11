import { EditorData } from "@/features/editor/types";
import { extractPlaceNamesForSlug } from "@/app/itineraries/utils/extractPlaceImages";

export interface ItineraryStats {
  title: string;
  numberOfDays: number;
  numberOfPlaces: number;
}

/**
 * Extract itinerary statistics and images from editor data
 */
export function extractItineraryStats(editorData: EditorData): ItineraryStats {
  const stats: ItineraryStats = {
    title: "Untitled Itinerary",
    numberOfDays: 0,
    numberOfPlaces: 0
  };

  if (!editorData || !editorData.blocks) {
    return stats;
  }

  let dayCount = 0;
  let placeCount = 0;

  for (const block of editorData.blocks) {
    // Extract title from first header block (only if we haven't found one yet)
    if (block.type === "header" && stats.title === "Untitled Itinerary") {
      const headerData = block.data as any;
      if (headerData?.text && typeof headerData.text === 'string') {
        stats.title = headerData.text;
        console.log("📝 Extracted title from header block:", stats.title);
      }
    }

    // Count days
    if (block.type === "day") {
      dayCount++;
    }

    // Count places
    if (block.type === "place" || block.type === "hotel") {
      const placeData = block.data as any;
      if (placeData?.name) {
        placeCount++;
      }
    }
  }

  stats.numberOfDays = dayCount;
  stats.numberOfPlaces = placeCount;

  return stats;
}

/**
 * Extract first 5 words from first header element in editor data
 */
function extractTitleFromFirstHeader(editorData: EditorData): string {
  if (!editorData || !editorData.blocks || !Array.isArray(editorData.blocks)) {
    return "";
  }

  // Find first header block
  for (const block of editorData.blocks) {
    if (block.type === "header") {
      const headerData = block.data as any;
      if (headerData?.text && typeof headerData.text === 'string') {
        // Extract first 5 words from header text
        const words = headerData.text
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .trim()
          .split(/\s+/)
          .slice(0, 5); // Take first 5 words
        
        return words.join(' ');
      }
    }
  }

  return "";
}

/**
 * Generate a SEO-friendly slug from itinerary title and places
 */
export function generateItinerarySlug(title: string, id: string, editorData?: EditorData): string {
  try {
    const slugParts: string[] = [];

    // First try to extract title from first header in editor data
    if (editorData) {
      try {
        const headerTitle = extractTitleFromFirstHeader(editorData);
        if (headerTitle) {
          const cleanTitle = headerTitle
            .toLowerCase()
            .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens and underscores
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
            .trim()
            .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

          if (cleanTitle && cleanTitle.length > 0) {
            slugParts.push(cleanTitle);
          }
        }
      } catch (error) {
        console.warn('Error extracting header title for slug:', error);
      }
    }

    // Fallback to provided title if no header title found
    if (slugParts.length === 0 && title && title !== "Untitled Itinerary") {
      try {
        const cleanTitle = title
          .toLowerCase()
          .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens and underscores
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
          .trim()
          .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

        if (cleanTitle && cleanTitle.length > 0) {
          slugParts.push(cleanTitle);
        }
      } catch (error) {
        console.warn('Error cleaning title for slug:', error);
      }
    }

    // Add place names if available
    if (editorData) {
      try {
        const placeNames = extractPlaceNamesForSlug(editorData, 2);
        if (placeNames.length > 0) {
          // Ensure place names are valid
          const validPlaceNames = placeNames.filter(name => name && name.length > 0);
          if (validPlaceNames.length > 0) {
            slugParts.push(...validPlaceNames);
          }
        }
      } catch (error) {
        console.warn('Error extracting place names for slug:', error);
      }
    }

    // Create final slug with validation
    if (slugParts.length > 0) {
      const baseSlug = slugParts.join('-').substring(0, 50); // Limit length
      // Ensure the final slug doesn't have problematic characters
      const finalSlug = baseSlug.replace(/[^a-zA-Z0-9-]/g, '').replace(/-+/g, '-');
      if (finalSlug && finalSlug.length > 0) {
        return `${finalSlug}-${id}`;
      }
    }

    // Fallback to ID only (this should always be safe)
    return id;
  } catch (error) {
    console.error('Error generating itinerary slug, falling back to ID only:', error);
    // Ultimate fallback - just use the ID
    return id;
  }
}

/**
 * Extract ID from slug (reverse of generateItinerarySlug)
 */
export function extractIdFromSlug(slug: string): string {
  try {
    if (!slug || typeof slug !== 'string') {
      throw new Error('Invalid slug provided');
    }
    
    // ID is always at the end after the last hyphen
    const parts = slug.split('-');
    const id = parts[parts.length - 1];
    
    if (!id || id.length === 0) {
      throw new Error('No ID found in slug');
    }
    
    return id;
  } catch (error) {
    console.error('Error extracting ID from slug:', slug, error);
    // If we can't extract an ID, return the original slug as fallback
    return slug;
  }
}