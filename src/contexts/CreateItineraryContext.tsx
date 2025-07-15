"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { NewItineraryForm } from "@/app/create-itinerary/types";

interface CreateItineraryContextType {
  formData: Partial<NewItineraryForm>;
  updateFormData: (field: keyof NewItineraryForm, value: any) => void;
  setFormData: (data: Partial<NewItineraryForm>) => void;
  clearFormData: () => void;
  isFormDirty: boolean;
}

const CreateItineraryContext = createContext<
  CreateItineraryContextType | undefined
>(undefined);

const STORAGE_KEY = "create-itinerary-form-data";

const getDefaultFormData = (): Partial<NewItineraryForm> => {
  return {
    destination: "",
    startDate: "",
    endDate: "",
    interests: [],
    travelStyle: undefined,
    additionalNotes: "",
  };
};

export function CreateItineraryProvider({ children }: { children: ReactNode }) {
  const [formData, setFormDataState] =
    useState<Partial<NewItineraryForm>>(getDefaultFormData);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage only on client side after hydration
  useEffect(() => {
    if (typeof window !== "undefined" && !isInitialized) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsedData = JSON.parse(saved);
          // Validate dates are still valid (not in the past)
          const today = new Date().toISOString().split("T")[0];
          if (parsedData.startDate && parsedData.startDate < today) {
            parsedData.startDate = "";
            parsedData.endDate = "";
          }

          // Ensure date fields are properly handled
          const cleanedData = {
            ...parsedData,
            startDate: parsedData.startDate || "",
            endDate: parsedData.endDate || "",
            interests: parsedData.interests || [],
            travelStyle: parsedData.travelStyle || undefined,
            additionalNotes: parsedData.additionalNotes || "",
          };

          setFormDataState(cleanedData);
          // Only set dirty if there's actual data
          const hasData =
            cleanedData.destination ||
            cleanedData.startDate ||
            cleanedData.endDate ||
            cleanedData.interests?.length > 0 ||
            cleanedData.travelStyle ||
            cleanedData.additionalNotes;
          setIsFormDirty(!!hasData);
        }
      } catch (error) {
        console.error("Error loading form data from localStorage:", error);
      }
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // Save to localStorage whenever formData changes (only after initialization)
  useEffect(() => {
    if (typeof window !== "undefined" && isInitialized) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
      } catch (error) {
        console.error("Error saving form data to localStorage:", error);
      }
    }
  }, [formData, isInitialized]);

  const updateFormData = (field: keyof NewItineraryForm, value: any) => {
    setFormDataState((prev) => ({ ...prev, [field]: value }));
    setIsFormDirty(true);
  };

  const setFormData = (data: Partial<NewItineraryForm>) => {
    setFormDataState(data);
    setIsFormDirty(true);
  };

  const clearFormData = () => {
    const initialData = {
      destination: "",
      startDate: "",
      endDate: "",
      interests: [],
      travelStyle: undefined,
      additionalNotes: "",
    };
    setFormDataState(initialData);
    setIsFormDirty(false);

    // Clear from localStorage
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.error("Error clearing form data from localStorage:", error);
      }
    }
  };

  return (
    <CreateItineraryContext.Provider
      value={{
        formData,
        updateFormData,
        setFormData,
        clearFormData,
        isFormDirty,
      }}
    >
      {children}
    </CreateItineraryContext.Provider>
  );
}

export function useCreateItineraryForm() {
  const context = useContext(CreateItineraryContext);
  if (context === undefined) {
    throw new Error(
      "useCreateItineraryForm must be used within a CreateItineraryProvider"
    );
  }
  return context;
}
