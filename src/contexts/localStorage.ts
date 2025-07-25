/**
 * localStorage utilities for persisting itinerary context
 */

import { GeneratedItinerary } from "@/services/openai/itinerary";
import { EditorData } from "@/features/editor/types";

// Key for localStorage
const ITINERARY_STORAGE_KEY = "itera-notes-itinerary";

// Shape of data we persist to localStorage
export interface PersistedItineraryState {
  currentItinerary: GeneratedItinerary | null;
  editorData: EditorData | null;
  lastUpdated: string | null; // ISO string format
  version: string; // For handling schema migrations
}

// Current version for handling future schema changes
const STORAGE_VERSION = "1.0.0";

/**
 * Save itinerary state to localStorage
 */
export function saveItineraryToStorage(
  currentItinerary: GeneratedItinerary | null,
  editorData: EditorData | null,
  lastUpdated: Date | null
): void {
  try {
    // Skip if running on server
    if (typeof window === "undefined") {
      return;
    }

    const dataToSave: PersistedItineraryState = {
      currentItinerary,
      editorData,
      lastUpdated: lastUpdated?.toISOString() || null,
      version: STORAGE_VERSION,
    };

    const serialized = JSON.stringify(dataToSave);
    localStorage.setItem(ITINERARY_STORAGE_KEY, serialized);
    
    console.log("💾 Saved itinerary to localStorage", {
      hasItinerary: !!currentItinerary,
      hasEditorData: !!editorData,
      lastUpdated: lastUpdated?.toISOString(),
    });
  } catch (error) {
    console.error("❌ Failed to save itinerary to localStorage:", error);
  }
}

/**
 * Load itinerary state from localStorage
 */
export function loadItineraryFromStorage(): {
  currentItinerary: GeneratedItinerary | null;
  editorData: EditorData | null;
  lastUpdated: Date | null;
} | null {
  try {
    // Skip if running on server
    if (typeof window === "undefined") {
      return null;
    }

    const stored = localStorage.getItem(ITINERARY_STORAGE_KEY);
    if (!stored) {
      console.log("📂 No itinerary found in localStorage");
      return null;
    }

    const parsed: PersistedItineraryState = JSON.parse(stored);
    
    // Check version compatibility
    if (parsed.version !== STORAGE_VERSION) {
      console.warn(`⚠️ localStorage version mismatch: ${parsed.version} vs ${STORAGE_VERSION}`);
      // For now, clear old data. In future, could add migration logic here
      clearItineraryFromStorage();
      return null;
    }

    const result = {
      currentItinerary: parsed.currentItinerary,
      editorData: parsed.editorData,
      lastUpdated: parsed.lastUpdated ? new Date(parsed.lastUpdated) : null,
    };

    console.log("📂 Loaded itinerary from localStorage", {
      hasItinerary: !!result.currentItinerary,
      hasEditorData: !!result.editorData,
      lastUpdated: result.lastUpdated?.toISOString(),
    });

    return result;
  } catch (error) {
    console.error("❌ Failed to load itinerary from localStorage:", error);
    // Clear corrupted data
    clearItineraryFromStorage();
    return null;
  }
}

/**
 * Clear itinerary data from localStorage
 */
export function clearItineraryFromStorage(): void {
  try {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.removeItem(ITINERARY_STORAGE_KEY);
    console.log("🗑️ Cleared itinerary from localStorage");
  } catch (error) {
    console.error("❌ Failed to clear itinerary from localStorage:", error);
  }
}

/**
 * Check if there's any itinerary data in localStorage
 */
export function hasItineraryInStorage(): boolean {
  try {
    if (typeof window === "undefined") {
      return false;
    }

    return localStorage.getItem(ITINERARY_STORAGE_KEY) !== null;
  } catch (error) {
    console.error("❌ Failed to check localStorage:", error);
    return false;
  }
}

/**
 * Get storage usage info for debugging
 */
export function getStorageInfo(): {
  hasData: boolean;
  size: number;
  lastUpdated: string | null;
} | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }

    const stored = localStorage.getItem(ITINERARY_STORAGE_KEY);
    if (!stored) {
      return { hasData: false, size: 0, lastUpdated: null };
    }

    const parsed: PersistedItineraryState = JSON.parse(stored);
    
    return {
      hasData: true,
      size: stored.length,
      lastUpdated: parsed.lastUpdated,
    };
  } catch (error) {
    console.error("❌ Failed to get storage info:", error);
    return null;
  }
}