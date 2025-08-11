"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import {
  GeneratedItinerary,
  ItineraryDay,
  PlaceLocation,
} from "@/services/openai/itinerary";
import { EditorData } from "@/features/editor/types";
import { DirectionsData } from "@/features/directions/types";
import { saveItinerary, loadItinerary } from "@/features/data";
import { generateContentHash } from "@/features/data";
import { convertEditorDataToItinerary } from "@/app/create-itinerary/utils/editorConverter";

// Database persistence with auto-save
let autoSaveTimeoutId: NodeJS.Timeout | null = null;
const AUTO_SAVE_DELAY = 500; // 500ms debounce

// Helper function removed - now using saveItinerary directly in auto-save

// Extract title from editor data
const extractTitleFromEditorData = (editorData: EditorData): string | undefined => {
  try {
    if (!editorData || !editorData.blocks || !Array.isArray(editorData.blocks)) {
      return undefined;
    }
    const headerBlock = editorData.blocks.find((block) => block && block.type === "header");
    return headerBlock ? (headerBlock.data as any)?.text : undefined;
  } catch (error) {
    console.error("Error extracting title from editor data:", error);
    return undefined;
  }
};

// Define the shape of our itinerary state
export interface ItineraryState {
  // Current itinerary ID for database persistence
  currentItineraryId: string | null;

  // Current itinerary data (derived from editorData)
  currentItinerary: GeneratedItinerary | null;

  // Editor.js data representation (primary source of truth)
  editorData: EditorData | null;

  // Driving directions data for map visualization
  directionsData: DirectionsData[];

  // Form metadata from create-itinerary form
  formMetadata: {
    destination?: string;
    startDate?: Date;
    endDate?: Date;
    interests?: string[];
    travelStyle?: string;
    additionalNotes?: string;
  } | null;

  // Loading and error states
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Metadata
  lastUpdated: Date | null;
  lastSaved: Date | null;
  isDirty: boolean; // Has unsaved changes
  contentHash: string | null; // For change detection

  // Place selection for map interaction
  selectedPlace: { uid: string; dayIndex: number } | null;
}

// Define action types for the reducer
export type ItineraryAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_SAVING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "LOAD_ITINERARY"; payload: { id: string; editorData: EditorData; directions: DirectionsData[]; lastUpdated: Date; formMetadata?: { destination?: string; startDate?: Date; endDate?: Date; interests?: string[]; travelStyle?: string; additionalNotes?: string; } } }
  | { type: "SET_ITINERARY"; payload: GeneratedItinerary }
  | { type: "SET_EDITOR_DATA"; payload: EditorData }
  | { type: "UPDATE_EDITOR_DATA"; payload: EditorData } // Force dirty state
  | { type: "SET_DIRECTIONS_DATA"; payload: DirectionsData[] }
  | { type: "SET_FORM_METADATA"; payload: { destination?: string; startDate?: Date; endDate?: Date; interests?: string[]; travelStyle?: string; additionalNotes?: string; } }
  | {
      type: "UPDATE_DAY";
      payload: { dayNumber: number; day: Partial<ItineraryDay> };
    }
  | {
      type: "UPDATE_PLACE";
      payload: {
        dayNumber: number;
        placeIndex: number;
        place: Partial<PlaceLocation>;
      };
    }
  | { type: "ADD_PLACE"; payload: { dayNumber: number; place: PlaceLocation } }
  | { type: "REMOVE_PLACE"; payload: { dayNumber: number; placeIndex: number } }
  | {
      type: "REORDER_PLACES";
      payload: { dayNumber: number; fromIndex: number; toIndex: number };
    }
  | { type: "CLEAR_ITINERARY" }
  | { type: "MARK_SAVED" }
  | { type: "MARK_DIRTY" }
  | {
      type: "SET_SELECTED_PLACE";
      payload: { uid: string; dayIndex: number } | null;
    };

// Initial state
const initialState: ItineraryState = {
  currentItineraryId: null,
  currentItinerary: null,
  editorData: null,
  directionsData: [],
  formMetadata: null,
  isLoading: false,
  isSaving: false,
  error: null,
  lastUpdated: null,
  lastSaved: null,
  isDirty: false,
  contentHash: null,
  selectedPlace: null,
};

// Reducer function
function itineraryReducer(
  state: ItineraryState,
  action: ItineraryAction
): ItineraryState {
  switch (action.type) {
    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
        error: action.payload ? null : state.error, // Clear error when starting to load
      };

    case "SET_SAVING":
      return {
        ...state,
        isSaving: action.payload,
      };

    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case "LOAD_ITINERARY":
      const newContentHash = action.payload.editorData ? generateContentHash(action.payload.editorData) : null;
      return {
        ...state,
        currentItineraryId: action.payload.id,
        editorData: action.payload.editorData,
        directionsData: action.payload.directions,
        formMetadata: action.payload.formMetadata || null,
        currentItinerary: action.payload.editorData ? convertEditorDataToItinerary(action.payload.editorData) : null,
        lastUpdated: action.payload.lastUpdated,
        lastSaved: action.payload.lastUpdated,
        contentHash: newContentHash,
        isDirty: false,
        isLoading: false,
        error: null,
      };

    case "SET_ITINERARY":
      return {
        ...state,
        currentItinerary: action.payload,
        // Clear directions data when setting new itinerary - new places need new routes
        directionsData: [],
        lastUpdated: new Date(),
        isDirty: false,
        isLoading: false,
        error: null,
      };

    case "SET_EDITOR_DATA":
      const editorContentHash = action.payload ? generateContentHash(action.payload) : null;
      // Always consider it dirty when editor data changes (unless hash is exactly the same)
      const isContentChanged = editorContentHash !== state.contentHash;
      
      return {
        ...state,
        editorData: action.payload,
        currentItinerary: action.payload ? convertEditorDataToItinerary(action.payload) : null,
        contentHash: editorContentHash,
        lastUpdated: new Date(),
        isDirty: isContentChanged,
      };

    case "UPDATE_EDITOR_DATA":
      const updateContentHash = action.payload ? generateContentHash(action.payload) : null;
      
      return {
        ...state,
        editorData: action.payload,
        currentItinerary: action.payload ? convertEditorDataToItinerary(action.payload) : null,
        contentHash: updateContentHash,
        lastUpdated: new Date(),
        isDirty: true, // Force dirty state for updates (even if hash unchanged for text edits)
      };

    case "SET_DIRECTIONS_DATA":
      return {
        ...state,
        directionsData: action.payload,
        lastUpdated: new Date(),
        isDirty: true,
      };

    case "SET_FORM_METADATA":
      return {
        ...state,
        formMetadata: action.payload,
        lastUpdated: new Date(),
        isDirty: true,
      };

    case "UPDATE_DAY":
      if (!state.currentItinerary) return state;

      return {
        ...state,
        currentItinerary: {
          ...state.currentItinerary,
          days: state.currentItinerary.days.map((day) =>
            day.dayNumber === action.payload.dayNumber
              ? { ...day, ...action.payload.day }
              : day
          ),
        },
        lastUpdated: new Date(),
        isDirty: true,
      };

    case "UPDATE_PLACE":
      if (!state.currentItinerary) return state;

      return {
        ...state,
        currentItinerary: {
          ...state.currentItinerary,
          days: state.currentItinerary.days.map((day) =>
            day.dayNumber === action.payload.dayNumber
              ? {
                  ...day,
                  places: day.places.map((place, index) =>
                    index === action.payload.placeIndex
                      ? { ...place, ...action.payload.place }
                      : place
                  ),
                }
              : day
          ),
        },
        lastUpdated: new Date(),
        isDirty: true,
      };

    case "ADD_PLACE":
      if (!state.currentItinerary) return state;

      return {
        ...state,
        currentItinerary: {
          ...state.currentItinerary,
          days: state.currentItinerary.days.map((day) =>
            day.dayNumber === action.payload.dayNumber
              ? {
                  ...day,
                  places: [...day.places, action.payload.place],
                }
              : day
          ),
        },
        // Clear directions data when places are added - routes need recalculation
        directionsData: [],
        lastUpdated: new Date(),
        isDirty: true,
      };

    case "REMOVE_PLACE":
      if (!state.currentItinerary) return state;

      return {
        ...state,
        currentItinerary: {
          ...state.currentItinerary,
          days: state.currentItinerary.days.map((day) =>
            day.dayNumber === action.payload.dayNumber
              ? {
                  ...day,
                  places: day.places.filter(
                    (_, index) => index !== action.payload.placeIndex
                  ),
                }
              : day
          ),
        },
        // Clear directions data when places are removed - routes need recalculation
        directionsData: [],
        lastUpdated: new Date(),
        isDirty: true,
      };

    case "REORDER_PLACES":
      if (!state.currentItinerary) return state;

      return {
        ...state,
        currentItinerary: {
          ...state.currentItinerary,
          days: state.currentItinerary.days.map((day) =>
            day.dayNumber === action.payload.dayNumber
              ? {
                  ...day,
                  places: reorderArray(
                    day.places,
                    action.payload.fromIndex,
                    action.payload.toIndex
                  ),
                }
              : day
          ),
        },
        // Clear directions data when places are reordered - routes need recalculation
        directionsData: [],
        lastUpdated: new Date(),
        isDirty: true,
      };

    case "CLEAR_ITINERARY":
      return {
        ...initialState,
      };

    case "MARK_SAVED":
      return {
        ...state,
        isDirty: false,
        lastSaved: new Date(),
      };

    case "MARK_DIRTY":
      return {
        ...state,
        isDirty: true,
        lastUpdated: new Date(),
      };

    case "SET_SELECTED_PLACE":
      return {
        ...state,
        selectedPlace: action.payload,
      };

    default:
      return state;
  }
}

// Helper function to reorder array items
function reorderArray<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  const result = [...array];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

// Context value interface
interface ItineraryContextValue {
  state: ItineraryState;

  // Actions
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
  loadItinerary: (id: string) => Promise<void>;
  setItinerary: (itinerary: GeneratedItinerary) => void;
  setEditorData: (data: EditorData) => void;
  updateEditorData: (data: EditorData) => void; // Force dirty for user changes
  setDirectionsData: (directions: DirectionsData[]) => void;
  setFormMetadata: (metadata: { destination?: string; startDate?: Date; endDate?: Date; interests?: string[]; travelStyle?: string; additionalNotes?: string; }) => void;
  updateDay: (dayNumber: number, day: Partial<ItineraryDay>) => void;
  updatePlace: (
    dayNumber: number,
    placeIndex: number,
    place: Partial<PlaceLocation>
  ) => void;
  addPlace: (dayNumber: number, place: PlaceLocation) => void;
  removePlace: (dayNumber: number, placeIndex: number) => void;
  reorderPlaces: (
    dayNumber: number,
    fromIndex: number,
    toIndex: number
  ) => void;
  clearItinerary: () => void;
  markSaved: () => void;
  markDirty: () => void;
  setSelectedPlace: (place: { uid: string; dayIndex: number } | null) => void;

  // Computed values
  hasItinerary: boolean;
  totalPlaces: number;
  getDayByNumber: (dayNumber: number) => ItineraryDay | undefined;
}

// Create the context
const ItineraryContext = createContext<ItineraryContextValue | undefined>(
  undefined
);

// Provider component props
interface ItineraryProviderProps {
  children: ReactNode;
}

// Provider component
export function ItineraryProvider({ children }: ItineraryProviderProps) {
  // Initialize state
  const [state, dispatch] = useReducer(itineraryReducer, initialState);

  // Auto-save to database whenever editorData changes (debounced)
  useEffect(() => {
    // Clear any existing timeout
    if (autoSaveTimeoutId) {
      clearTimeout(autoSaveTimeoutId);
    }

    // Only auto-save if we have editor data and it's dirty
    if (state.editorData && state.isDirty && !state.isSaving) {
      autoSaveTimeoutId = setTimeout(async () => {
        try {
          // Extract title from first header element
          const extractedTitle = extractTitleFromEditorData(state.editorData!);
          console.log("📝 Extracted title from first header:", extractedTitle);
          
          const response = await saveItinerary({
            id: state.currentItineraryId || undefined,
            title: extractedTitle,
            editorData: state.editorData!,
            directions: state.directionsData,
            
            // Include form metadata if available
            ...(state.formMetadata && {
              destination: state.formMetadata.destination,
              startDate: state.formMetadata.startDate,
              endDate: state.formMetadata.endDate,
              interests: state.formMetadata.interests,
              travelStyle: state.formMetadata.travelStyle,
              additionalNotes: state.formMetadata.additionalNotes,
            }),
          });

          if (response.success) {
            // Update currentItineraryId if we got a new one from the save
            if (response.id && response.id !== state.currentItineraryId) {
              dispatch({
                type: "LOAD_ITINERARY",
                payload: {
                  id: response.id,
                  editorData: state.editorData!,
                  directions: state.directionsData,
                  lastUpdated: new Date(),
                  formMetadata: state.formMetadata ? {
                    destination: state.formMetadata.destination,
                    startDate: state.formMetadata.startDate,
                    endDate: state.formMetadata.endDate,
                    interests: state.formMetadata.interests,
                    travelStyle: state.formMetadata.travelStyle,
                    additionalNotes: state.formMetadata.additionalNotes,
                  } : undefined,
                },
              });
              console.log("✅ Updated currentItineraryId to:", response.id);
            }

            if (response.unchanged) {
              console.log("📊 Content unchanged, save skipped:", response.id);
              // Content was unchanged - just mark as not dirty without showing save indicator
              dispatch({ type: "MARK_SAVED" });
            } else {
              console.log("✅ Auto-saved to database:", response.id);
              // Only show saving indicator when there are actual changes
              dispatch({ type: "SET_SAVING", payload: true });
              if (response.conflictResolved) {
                console.log("🔄 Conflict was resolved during save");
              }
              dispatch({ type: "MARK_SAVED" });
              dispatch({ type: "SET_SAVING", payload: false });
            }
          } else {
            console.error("❌ Auto-save failed:", response.error);
            dispatch({ type: "SET_ERROR", payload: "Failed to save itinerary" });
          }
        } catch (error) {
          console.error("Auto-save failed:", error);
          dispatch({ type: "SET_ERROR", payload: "Failed to save itinerary" });
        }
      }, AUTO_SAVE_DELAY);
    }

    // Cleanup on unmount
    return () => {
      if (autoSaveTimeoutId) {
        clearTimeout(autoSaveTimeoutId);
        autoSaveTimeoutId = null;
      }
    };
  }, [state.editorData, state.isDirty, state.isSaving, state.currentItineraryId]);

  // Action creators
  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: "SET_LOADING", payload: loading });
  }, []);

  const setSaving = useCallback((saving: boolean) => {
    dispatch({ type: "SET_SAVING", payload: saving });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: "SET_ERROR", payload: error });
  }, []);

  const loadItineraryById = useCallback(async (id: string) => {
    dispatch({ type: "SET_LOADING", payload: true });
    
    try {
      const response = await loadItinerary(id);
      
      if (response.success && response.data) {
        dispatch({
          type: "LOAD_ITINERARY",
          payload: {
            id: response.data.id,
            editorData: response.data.editorData,
            directions: response.data.directions,
            lastUpdated: response.data.lastUpdated,
            formMetadata: response.data.destination ? {
              destination: response.data.destination,
              startDate: response.data.startDate,
              endDate: response.data.endDate,
              interests: response.data.interests,
              travelStyle: response.data.travelStyle,
              additionalNotes: response.data.additionalNotes,
            } : undefined,
          },
        });
      } else {
        dispatch({ type: "SET_ERROR", payload: response.error || "Failed to load itinerary" });
      }
    } catch (error) {
      console.error("Error loading itinerary:", error);
      dispatch({ type: "SET_ERROR", payload: "Failed to load itinerary" });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  const setItinerary = useCallback((itinerary: GeneratedItinerary) => {
    dispatch({ type: "SET_ITINERARY", payload: itinerary });
  }, []);

  const setEditorData = useCallback((data: EditorData) => {
    dispatch({ type: "SET_EDITOR_DATA", payload: data });
  }, []);

  const updateEditorData = useCallback((data: EditorData) => {
    dispatch({ type: "UPDATE_EDITOR_DATA", payload: data });
  }, []);

  const setDirectionsData = useCallback((directions: DirectionsData[]) => {
    dispatch({ type: "SET_DIRECTIONS_DATA", payload: directions });
  }, []);

  const setFormMetadata = useCallback((metadata: { destination?: string; startDate?: Date; endDate?: Date; interests?: string[]; travelStyle?: string; additionalNotes?: string; }) => {
    dispatch({ type: "SET_FORM_METADATA", payload: metadata });
  }, []);

  const updateDay = useCallback(
    (dayNumber: number, day: Partial<ItineraryDay>) => {
      dispatch({ type: "UPDATE_DAY", payload: { dayNumber, day } });
    },
    []
  );

  const updatePlace = useCallback(
    (dayNumber: number, placeIndex: number, place: Partial<PlaceLocation>) => {
      dispatch({
        type: "UPDATE_PLACE",
        payload: { dayNumber, placeIndex, place },
      });
    },
    []
  );

  const addPlace = useCallback((dayNumber: number, place: PlaceLocation) => {
    dispatch({ type: "ADD_PLACE", payload: { dayNumber, place } });
  }, []);

  const removePlace = useCallback((dayNumber: number, placeIndex: number) => {
    dispatch({ type: "REMOVE_PLACE", payload: { dayNumber, placeIndex } });
  }, []);

  const reorderPlaces = useCallback(
    (dayNumber: number, fromIndex: number, toIndex: number) => {
      dispatch({
        type: "REORDER_PLACES",
        payload: { dayNumber, fromIndex, toIndex },
      });
    },
    []
  );

  const clearItinerary = useCallback(() => {
    dispatch({ type: "CLEAR_ITINERARY" });
  }, []);

  const markSaved = useCallback(() => {
    dispatch({ type: "MARK_SAVED" });
  }, []);

  const markDirty = useCallback(() => {
    dispatch({ type: "MARK_DIRTY" });
  }, []);

  const setSelectedPlace = useCallback(
    (place: { uid: string; dayIndex: number } | null) => {
      dispatch({ type: "SET_SELECTED_PLACE", payload: place });
    },
    []
  );

  // Computed values
  const hasItinerary = Boolean(state.currentItinerary);

  const totalPlaces =
    state.currentItinerary?.days.reduce(
      (total, day) => total + day.places.length,
      0
    ) ?? 0;

  const getDayByNumber = useCallback(
    (dayNumber: number): ItineraryDay | undefined => {
      return state.currentItinerary?.days.find(
        (day) => day.dayNumber === dayNumber
      );
    },
    [state.currentItinerary]
  );

  const value: ItineraryContextValue = {
    state,
    setLoading,
    setSaving,
    setError,
    loadItinerary: loadItineraryById,
    setItinerary,
    setEditorData,
    updateEditorData,
    setDirectionsData,
    setFormMetadata,
    updateDay,
    updatePlace,
    addPlace,
    removePlace,
    reorderPlaces,
    clearItinerary,
    markSaved,
    markDirty,
    setSelectedPlace,
    hasItinerary,
    totalPlaces,
    getDayByNumber,
  };

  return (
    <ItineraryContext.Provider value={value}>
      {children}
    </ItineraryContext.Provider>
  );
}

// Custom hook to use the context
export function useItinerary(): ItineraryContextValue {
  const context = useContext(ItineraryContext);

  if (context === undefined) {
    throw new Error("useItinerary must be used within an ItineraryProvider");
  }

  return context;
}

// Export the context for advanced use cases
export { ItineraryContext };
