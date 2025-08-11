import { Suspense } from "react";
import { listItineraries } from "@/features/data";
import { AuthProtected } from "@/features/auth/components/AuthProtected";
import { extractItineraryStats, ItineraryStats } from "@/utils/itinerary";
import { extractFirstTwoPlaceImages } from "./utils/extractPlaceImages";
import ItinerariesClient from "./components/ItinerariesClient";

function ItinerariesLoadingUI() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-600">Loading your itineraries...</p>
      </div>
    </div>
  );
}

async function ItinerariesData() {
  const response = await listItineraries();

  if (!response.success || !response.data) {
    throw new Error(response.error || "Failed to load itineraries");
  }

  const itineraries = response.data;
  const statsMap: Record<string, ItineraryStats> = {};
  const imagesMap: Record<string, string[]> = {};

  // Process each itinerary on the server
  itineraries.forEach((itinerary) => {
    if (itinerary.editorData) {
      try {
        // Extract stats
        const extractedStats = extractItineraryStats(itinerary.editorData);
        statsMap[itinerary.id] = extractedStats;

        console.log(`📊 Stats for ${itinerary.id}:`, {
          extractedTitle: extractedStats.title,
          dbTitle: itinerary.title,
          finalTitle: extractedStats.title || itinerary.title,
        });

        // Extract place images
        imagesMap[itinerary.id] = extractFirstTwoPlaceImages(
          itinerary.editorData
        );

        console.log(
          `📊 Processed itinerary ${itinerary.id}: ${
            statsMap[itinerary.id].numberOfPlaces
          } places, ${imagesMap[itinerary.id].length} images`
        );
      } catch (error) {
        console.error(
          `Error processing itinerary ${itinerary.id}:`,
          error
        );
        // Provide default stats if extraction fails
        statsMap[itinerary.id] = {
          title: itinerary.title || "Untitled Itinerary",
          numberOfDays: 0,
          numberOfPlaces: 0,
        };
        imagesMap[itinerary.id] = [];
      }
    } else {
      // No editor data available
      statsMap[itinerary.id] = {
        title: itinerary.title || "Untitled Itinerary",
        numberOfDays: 0,
        numberOfPlaces: 0,
      };
      imagesMap[itinerary.id] = [];
    }
  });

  return (
    <ItinerariesClient
      itineraries={itineraries}
      itineraryStats={statsMap}
      itineraryImages={imagesMap}
    />
  );
}

export default function MyItineraries() {
  return (
    <AuthProtected>
      <Suspense fallback={<ItinerariesLoadingUI />}>
        <ItinerariesData />
      </Suspense>
    </AuthProtected>
  );
}
