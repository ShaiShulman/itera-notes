"use client";

import { useEffect, useState } from "react";
import { hasUserItineraries, getLastViewedItinerary } from "@/features/data/server-actions";

interface UseUserItinerariesResult {
  hasItineraries: boolean | null;
  lastViewedItineraryId: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUserItineraries(): UseUserItinerariesResult {
  const [hasItineraries, setHasItineraries] = useState<boolean | null>(null);
  const [lastViewedItineraryId, setLastViewedItineraryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if user has itineraries
      const hasItinerariesResult = await hasUserItineraries();
      
      if (!hasItinerariesResult.success) {
        setError(hasItinerariesResult.error || "Failed to check itineraries");
        return;
      }

      const userHasItineraries = hasItinerariesResult.hasItineraries || false;
      setHasItineraries(userHasItineraries);

      // If user has itineraries, get the last viewed one
      if (userHasItineraries) {
        const lastViewedResult = await getLastViewedItinerary();
        
        if (!lastViewedResult.success) {
          setError(lastViewedResult.error || "Failed to get last viewed itinerary");
          return;
        }

        setLastViewedItineraryId(lastViewedResult.itineraryId || null);
      } else {
        setLastViewedItineraryId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    hasItineraries,
    lastViewedItineraryId,
    isLoading,
    error,
    refetch: fetchData,
  };
}