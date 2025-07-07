"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  ReactNode,
} from "react";
import {
  GeneratedItinerary,
  ItineraryDay,
  PlaceLocation,
} from "@/services/openai/itinerary";
import { EditorData } from "@/features/editor/types";

// Define the shape of our itinerary state
export interface ItineraryState {
  // Current itinerary data
  currentItinerary: GeneratedItinerary | null;

  // Editor.js data representation
  editorData: EditorData | null;

  // Loading and error states
  isLoading: boolean;
  error: string | null;

  // Metadata
  lastUpdated: Date | null;
  isDirty: boolean; // Has unsaved changes
}

// Define action types for the reducer
export type ItineraryAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_ITINERARY"; payload: GeneratedItinerary }
  | { type: "SET_EDITOR_DATA"; payload: EditorData }
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
  | { type: "MARK_DIRTY" };

// Initial state
const initialState: ItineraryState = {
  currentItinerary: null,
  editorData: null,
  isLoading: false,
  error: null,
  lastUpdated: null,
  isDirty: false,
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
  const [state, dispatch] = useReducer(itineraryReducer, initialState);

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
    updateDay,
    updatePlace,
    addPlace,
    removePlace,
    reorderPlaces,
    clearItinerary,
    markSaved,
    markDirty,
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
