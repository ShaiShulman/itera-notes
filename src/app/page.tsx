"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { useItinerary } from "@/contexts/ItineraryContext";
import {
  HiOutlineMap,
  HiOutlinePlus,
  HiOutlineSparkles,
} from "react-icons/hi2";
import Image from "next/image";

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { state } = useItinerary();

  // Redirect authenticated users based on itinerary state
  useEffect(() => {
    if (session) {
      if (state.currentItinerary || state.editorData) {
        console.log("📝 Itinerary found, redirecting to editor");
        router.push("/editor");
      } else {
        console.log("📝 No itinerary found, redirecting to create-itinerary");
        router.push("/create-itinerary");
      }
    }
  }, [session, state.currentItinerary, state.editorData, router]);

  // Show loading state while checking auth
  if (status === "loading") {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Show landing page for non-authenticated users
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="flex justify-center mb-12">
              <div className="relative">
                <Image
                  src="/brand-lg.png"
                  alt="breadcrumbs.ai"
                  width={700}
                  height={700}
                  className="h-64 w-auto"
                />
              </div>
            </div>

            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Follow your path with breadcrumbs.ai - the intelligent travel
              companion that helps you create detailed itineraries, discover
              amazing places, and navigate your journey with interactive maps
              and smart recommendations.
            </p>

            <div className="grid md:grid-cols-3 gap-8 mb-12 max-w-4xl mx-auto">
              <div className="text-center p-6 bg-white rounded-lg shadow-sm">
                <HiOutlinePlus className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Create Itineraries
                </h3>
                <p className="text-gray-600">
                  Build detailed travel plans with AI assistance and smart place
                  suggestions.
                </p>
              </div>

              <div className="text-center p-6 bg-white rounded-lg shadow-sm">
                <HiOutlineMap className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Interactive Maps
                </h3>
                <p className="text-gray-600">
                  Visualize your journey with integrated Google Maps and place
                  details.
                </p>
              </div>

              <div className="text-center p-6 bg-white rounded-lg shadow-sm">
                <HiOutlineSparkles className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Smart Features
                </h3>
                <p className="text-gray-600">
                  Get intelligent suggestions, place photos, and detailed travel
                  information.
                </p>
              </div>
            </div>

            <div className="space-y-4 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
              <button
                onClick={() => signIn("google")}
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show loading for authenticated users while redirecting
  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-500">Loading...</p>
      </div>
    </div>
  );
}
