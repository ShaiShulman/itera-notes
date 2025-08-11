"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useItinerary } from "@/contexts/ItineraryContext";
import { AuthProtected } from "@/features/auth/components/AuthProtected";
import { extractIdFromSlug } from "@/utils/itinerary";
import EditorPageContent from "@/components/EditorPageContent";

function SlugEditorContent() {
  const params = useParams();
  const router = useRouter();
  const { state, loadItinerary } = useItinerary();
  
  // Check if this is a fresh itinerary
  const isFreshFromCreate = typeof window !== 'undefined' && 
    sessionStorage.getItem('fresh-from-create') === 'true';
  const freshTimestamp = typeof window !== 'undefined' ? 
    sessionStorage.getItem('fresh-from-create-timestamp') : null;
  const isRecentFlag = freshTimestamp && 
    (Date.now() - parseInt(freshTimestamp)) < 30000;
  
  // Start optimistically - assume fresh itineraries will have context data
  const [isLoading, setIsLoading] = useState(!(isFreshFromCreate && isRecentFlag));
  const [error, setError] = useState<string | null>(null);
  const [hasCheckedFresh, setHasCheckedFresh] = useState(false);

  useEffect(() => {
    if (hasCheckedFresh) return; // Only run this check once

    const initializeItinerary = async () => {
      const slug = params.slug as string;
      if (!slug) {
        setError("Invalid itinerary URL");
        setIsLoading(false);
        setHasCheckedFresh(true);
        return;
      }

      const id = extractIdFromSlug(slug);

      // If we're already optimistically not loading (fresh itinerary case)
      if (!isLoading && isFreshFromCreate && isRecentFlag) {
        console.log("📄 Fresh itinerary - checking for context data");
        
        // Quick check for context data
        if (state.editorData && state.editorData.blocks && state.editorData.blocks.length > 0) {
          console.log("✅ Using existing itinerary data from context immediately");
          
          // Clear the fresh flags
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('fresh-from-create');
            sessionStorage.removeItem('fresh-from-create-timestamp');
            sessionStorage.removeItem('fresh-itinerary-id');
          }
          
          setHasCheckedFresh(true);
          return;
        } else {
          console.warn("⚠️ Fresh flag set but no context data yet, will need to load");
          // We'll need to load from database after all
          setIsLoading(true);
        }
      }

      // Load from database
      try {
        setError(null);
        
        console.log("📥 Loading itinerary from database:", id);
        
        // Load the itinerary from database
        await loadItinerary(id);
        
        // Clear any stale fresh flags
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('fresh-from-create');
          sessionStorage.removeItem('fresh-from-create-timestamp');
          sessionStorage.removeItem('fresh-itinerary-id');
        }
      } catch (err) {
        console.error("Error loading itinerary from slug:", err);
        setError("Failed to load itinerary");
      } finally {
        setIsLoading(false);
        setHasCheckedFresh(true);
      }
    };

    initializeItinerary();
  }, [params.slug, loadItinerary, state.editorData, hasCheckedFresh, isLoading, isFreshFromCreate, isRecentFlag]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading itinerary...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">❌ {error}</div>
          <button
            onClick={() => router.push("/itineraries")}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Itineraries
          </button>
        </div>
      </div>
    );
  }

  // Once loaded, render the normal editor
  return <EditorPageContent />;
}

export default function SlugEditorPage() {
  return (
    <AuthProtected>
      <SlugEditorContent />
    </AuthProtected>
  );
}
