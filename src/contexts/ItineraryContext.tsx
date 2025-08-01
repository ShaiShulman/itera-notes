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

// localStorage constants
const STORAGE_KEY = "itera-notes-itinerary-state";
const STORAGE_VERSION = "1.0";

// Helper functions for localStorage
const saveToLocalStorage = (state: ItineraryState) => {
  try {
    if (typeof window !== "undefined") {
      const dataToSave = {
        version: STORAGE_VERSION,
        state: {
          ...state,
          // Convert Date objects to ISO strings for storage
          lastUpdated: state.lastUpdated?.toISOString() || null,
        },
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      console.log("💾 Saved itinerary state to localStorage");
    }
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
  }
};

const loadFromLocalStorage = (): ItineraryState | null => {
  try {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      
      // Check version compatibility
      if (parsed.version !== STORAGE_VERSION) {
        console.warn("localStorage version mismatch, clearing stored data");
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      // Convert ISO strings back to Date objects
      const state = {
        ...parsed.state,
        lastUpdated: parsed.state.lastUpdated ? new Date(parsed.state.lastUpdated) : null,
      };

      console.log("📥 Loaded itinerary state from localStorage");
      return state;
    }
  } catch (error) {
    console.error("Failed to load from localStorage:", error);
    // Clear corrupted data
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return null;
};

// Define the shape of our itinerary state
export interface ItineraryState {
  // Current itinerary data
  currentItinerary: GeneratedItinerary | null;

  // Editor.js data representation
  editorData: EditorData | null;

  // Driving directions data for map visualization
  directionsData: DirectionsData[];

  // Loading and error states
  isLoading: boolean;
  error: string | null;

  // Metadata
  lastUpdated: Date | null;
  isDirty: boolean; // Has unsaved changes

  // Place selection for map interaction
  selectedPlace: { uid: string; dayIndex: number } | null;
}

// Define action types for the reducer
export type ItineraryAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_ITINERARY"; payload: GeneratedItinerary }
  | { type: "SET_EDITOR_DATA"; payload: EditorData }
  | { type: "SET_DIRECTIONS_DATA"; payload: DirectionsData[] }
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

// Initial state - will be overridden by localStorage if available
const initialState: ItineraryState = {
  currentItinerary: null,
  editorData: null,
  directionsData: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
  isDirty: false,
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

    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
        isLoading: false,
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
      return {
        ...state,
        editorData: action.payload,
        lastUpdated: new Date(),
        isDirty: true,
      };

    case "SET_DIRECTIONS_DATA":
      return {
        ...state,
        directionsData: action.payload,
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
        lastUpdated: new Date(),
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
  setError: (error: string | null) => void;
  setItinerary: (itinerary: GeneratedItinerary) => void;
  setEditorData: (data: EditorData) => void;
  setDirectionsData: (directions: DirectionsData[]) => void;
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
  // Initialize state with localStorage data if available
  const [state, dispatch] = useReducer(itineraryReducer, initialState, (initial) => {
    const stored = loadFromLocalStorage();
    return stored || initial;
  });

  // Save to localStorage whenever state changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveToLocalStorage(state);
    }, 500); // 500ms debounce to prevent excessive writes

    return () => clearTimeout(timeoutId);
  }, [state]);

  // Action creators
  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: "SET_LOADING", payload: loading });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: "SET_ERROR", payload: error });
  }, []);

  const setItinerary = useCallback((itinerary: GeneratedItinerary) => {
    dispatch({ type: "SET_ITINERARY", payload: itinerary });
  }, []);

  const setEditorData = useCallback((data: EditorData) => {
    dispatch({ type: "SET_EDITOR_DATA", payload: data });
  }, []);

  const setDirectionsData = useCallback((directions: DirectionsData[]) => {
    dispatch({ type: "SET_DIRECTIONS_DATA", payload: directions });
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
    setError,
    setItinerary,
    setEditorData,
    setDirectionsData,
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
