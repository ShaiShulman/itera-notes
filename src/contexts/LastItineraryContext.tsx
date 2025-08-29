"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

interface LastItineraryContextType {
  lastEditedItineraryId: string | null;
  setLastEditedItinerary: (itineraryId: string) => void;
  clearLastEditedItinerary: () => void;
}

const LastItineraryContext = createContext<LastItineraryContextType | undefined>(
  undefined
);

export function useLastItinerary() {
  const context = useContext(LastItineraryContext);
  if (context === undefined) {
    throw new Error('useLastItinerary must be used within a LastItineraryProvider');
  }
  return context;
}

interface LastItineraryProviderProps {
  children: React.ReactNode;
}

const STORAGE_KEY = 'lastEditedItinerary';

export function LastItineraryProvider({ children }: LastItineraryProviderProps) {
  const [lastEditedItineraryId, setLastEditedItineraryIdState] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setLastEditedItineraryIdState(stored);
      }
    }
  }, []);

  const setLastEditedItinerary = (itineraryId: string) => {
    setLastEditedItineraryIdState(itineraryId);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, itineraryId);
    }
  };

  const clearLastEditedItinerary = () => {
    setLastEditedItineraryIdState(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const value: LastItineraryContextType = {
    lastEditedItineraryId,
    setLastEditedItinerary,
    clearLastEditedItinerary,
  };

  return (
    <LastItineraryContext.Provider value={value}>
      {children}
    </LastItineraryContext.Provider>
  );
}