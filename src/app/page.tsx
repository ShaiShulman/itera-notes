"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useItinerary } from "@/contexts/ItineraryContext";

export default function HomePage() {
  const router = useRouter();
  const { state } = useItinerary();

  // Redirect based on itinerary state
  useEffect(() => {
    if (state.currentItinerary || state.editorData) {
      console.log("📝 Itinerary found, redirecting to editor");
      router.push("/editor");
    } else {
      console.log("📝 No itinerary found, redirecting to create-itinerary");
      router.push("/create-itinerary");
    }
  }, [state.currentItinerary, state.editorData, router]);

  // Show loading state while redirecting
  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-500">Loading...</p>
      </div>
    </div>
  );
}
