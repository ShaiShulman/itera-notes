"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useItinerary } from "@/contexts/ItineraryContext";
import { AuthProtected } from "@/features/auth/components/AuthProtected";
import EditorPageContent from "@/components/EditorPageContent";

function EditorPageWithRedirect() {
  const router = useRouter();
  const { state } = useItinerary();
  
  // Check immediately if we have a fresh redirect flag (to avoid any flash)
  const hasFreshFlag = typeof window !== 'undefined' && 
    sessionStorage.getItem('fresh-from-create') === 'true';
    
  const [isRedirecting, setIsRedirecting] = useState(hasFreshFlag);

  useEffect(() => {
    // If we have an itinerary ID and we're on the basic editor page,
    // redirect to the slug URL for better UX and SEO
    if (state.currentItineraryId && state.editorData) {
      const checkForSlugRedirect = async () => {
        try {
          // Double-check that we still have the required data
          if (!state.currentItineraryId || !state.editorData) {
            return;
          }
          
          // Check if this is a fresh itinerary that should get a slug URL
          const isFreshFromCreate = typeof window !== 'undefined' && 
            sessionStorage.getItem('fresh-from-create') === 'true';
          
          if (isFreshFromCreate) {
            console.log("📍 Redirecting fresh itinerary to slug URL");
            setIsRedirecting(true);
            
            // Import the slug generation utility
            const { generateItinerarySlug, extractItineraryStats } = await import("@/utils/itinerary");
            
            // Generate slug from the current itinerary data
            const stats = extractItineraryStats(state.editorData);
            const slug = generateItinerarySlug(stats.title, state.currentItineraryId, state.editorData);
            
            // Clear the fresh flags since we're handling the redirect
            if (typeof window !== 'undefined') {
              sessionStorage.removeItem('fresh-from-create');
              sessionStorage.removeItem('fresh-from-create-timestamp');
              sessionStorage.removeItem('fresh-itinerary-id');
            }
            
            // Redirect to the slug URL
            router.replace(`/editor/${slug}`);
          } else if (isRedirecting) {
            // If we were expecting to redirect but didn't, clear the redirect state
            setIsRedirecting(false);
          }
        } catch (error) {
          console.warn("Error redirecting to slug URL:", error);
        }
      };

      checkForSlugRedirect();
    }
  }, [state.currentItineraryId, state.editorData, router, isRedirecting]);

  // Show loading while redirecting to prevent flash
  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Setting up your itinerary...</p>
        </div>
      </div>
    );
  }

  return <EditorPageContent />;
}

export default function EditorPage() {
  return (
    <AuthProtected>
      <EditorPageWithRedirect />
    </AuthProtected>
  );
}
