import { EditorData, EditorBlockData } from "@/features/editor/types";
import { createHash } from "crypto";

/**
 * Excludes UI-specific state from block data that shouldn't affect persistence
 * @param data Block data object
 * @returns Cleaned data object for hashing
 */
function excludeUIState(data: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...data };
  
  // Remove UI-specific properties that don't affect content
  delete cleaned.expanded;
  delete cleaned.collapsed;
  delete cleaned.hasBeenSearched;
  
  // Remove thumbnail URLs as they can change but don't affect content
  delete cleaned.thumbnailUrl;
  
  // Keep status - it indicates if a place was found vs free text, which is content-relevant
  // Keep loading states temporarily but filter out transient ones
  if (cleaned.status === 'loading') {
    delete cleaned.status; // Only exclude loading state as it's transient
  }
  
  
  // For Editor.js text blocks, keep only essential content
  if (typeof cleaned.text === 'string') {
    // Normalize whitespace and strip HTML tags for consistent text comparison
    const normalizedText = cleaned.text
      .trim()
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/\s+/g, ' '); // Normalize multiple spaces to single space
    
    // For text blocks, create a minimal object with only essential properties
    const result: Record<string, unknown> = {
      text: normalizedText,
    };
    
    // Keep level for headers
    if (cleaned.level) {
      result.level = cleaned.level;
    }
    
    return result;
  }
  
  return cleaned;
}

/**
 * Checks if a block is "empty" or "skeleton" and shouldn't trigger saves
 */
function isEmptyBlock(block: EditorBlockData): boolean {
  if (!block || !block.data) return true;
  
  const data = block.data as any;
  
  // For place/hotel blocks, consider empty if no name or only default values
  if (block.type === 'place' || block.type === 'hotel') {
    return !data.name || 
           data.name === '' ||
           (data.status === 'idle' && !data.placeId);
  }
  
  // For day blocks, consider empty if no places
  if (block.type === 'day') {
    return !data.places || data.places.length === 0 || 
           data.places.every((place: any) => !place.name || place.name === '');
  }
  
  // For text blocks, consider empty if no text
  if (block.type === 'paragraph' || block.type === 'header') {
    return !data.text || data.text.trim() === '';
  }
  
  return false;
}

/**
 * Generates a content hash for EditorData, excluding UI state
 * Only considers data that should trigger a save to the database
 * @param editorData The editor data to hash
 * @returns SHA-256 hash of the content
 */
export function generateContentHash(editorData: EditorData): string {
  // Handle undefined or invalid data
  if (!editorData || !editorData.blocks || !Array.isArray(editorData.blocks)) {
    console.warn("generateContentHash: Invalid editorData provided", editorData);
    return "";
  }

  try {
    // Create a filtered version for hashing, excluding empty blocks
    const filteredBlocks = editorData.blocks
      .filter((block: EditorBlockData) => !isEmptyBlock(block)) // Filter out empty blocks
      .map((block: EditorBlockData) => ({
        // Don't include ID in hash - content should be the same regardless of block ID
        type: block?.type || "",
        data: block?.data ? excludeUIState(block.data) : {},
      }));

    const filteredData = {
      blocks: filteredBlocks,
      version: editorData.version || "",
    };

    // Create deterministic JSON string (simplified approach)
    const jsonString = JSON.stringify(filteredData);
    
    // Generate SHA-256 hash
    const hash = createHash('sha256').update(jsonString).digest('hex');
    
    return hash;
  } catch (error) {
    console.error("Error generating content hash:", error);
    return "";
  }
}

/**
 * Compares two EditorData objects by their content hash
 * @param data1 First EditorData object
 * @param data2 Second EditorData object
 * @returns true if content is identical (excluding UI state)
 */
export function isContentEqual(data1: EditorData, data2: EditorData): boolean {
  return generateContentHash(data1) === generateContentHash(data2);
}

/**
 * Debug function to log what's included in the hash
 * @param editorData The editor data to analyze
 */
export function debugContentHash(editorData: EditorData): void {
  const filteredData = {
    blocks: editorData.blocks.map((block: EditorBlockData) => ({
      id: block.id,
      type: block.type,
      data: excludeUIState(block.data),
    })),
    version: editorData.version,
  };
  
  console.log("📊 Content hash debug:", {
    originalBlocks: editorData.blocks.length,
    filteredData,
    hash: generateContentHash(editorData),
  });
}